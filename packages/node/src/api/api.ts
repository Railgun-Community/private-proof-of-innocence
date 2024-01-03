/// <reference types="../types/index" />
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import debug from 'debug';
import { Server } from 'http';
import {
  Validator,
  ValidationError,
  AllowedSchema,
} from 'express-json-validator-middleware';
import { isListProvider } from '../config/general';
import { QueryLimits } from '../config/query-limits';
import {
  NodeStatusAllNetworks,
  GetTransactProofsParams,
  GetBlockedShieldsParams,
  SubmitTransactProofParams,
  GetPOIsPerListParams,
  GetMerkleProofsParams,
  ValidateTxidMerklerootParams,
  GetLatestValidatedRailgunTxidParams,
  ValidatedRailgunTxidStatus,
  MerkleProof,
  POIsPerListMap,
  isDefined,
  TransactProofData,
  SubmitLegacyTransactProofParams,
  LegacyTransactProofData,
  ValidatePOIMerklerootsParams,
  SubmitSingleCommitmentProofsParams,
} from '@railgun-community/shared-models';
import {
  GetTransactProofsBodySchema,
  SubmitTransactProofBodySchema,
  GetPOIsPerListBodySchema,
  GetMerkleProofsBodySchema,
  ValidateTxidMerklerootBodySchema,
  GetBlockedShieldsBodySchema,
  GetLatestValidatedRailgunTxidBodySchema,
  GetPOIListEventRangeBodySchema,
  SharedChainTypeIDParamsSchema,
  SubmitPOIEventBodySchema,
  SubmitValidatedTxidBodySchema,
  RemoveTransactProofBodySchema,
  GetLegacyTransactProofsBodySchema,
  SubmitLegacyTransactProofsBodySchema,
  ValidatePOIMerklerootsBodySchema,
  SubmitSingleCommitmentProofsBodySchema,
  GetPOIsPerBlindedCommitmentBodySchema,
  GetPOIMerkletreeLeavesBodySchema,
} from './schemas';
import 'dotenv/config';
import {
  GetLegacyTransactProofsParams,
  GetPOIListEventRangeParams,
  GetPOIMerkletreeLeavesParams,
  GetPOIsPerBlindedCommitmentParams,
  POISyncedListEvent,
  POIsPerBlindedCommitmentMap,
  RemoveTransactProofParams,
  SignedBlockedShield,
  SubmitPOIEventParams,
  SubmitValidatedTxidAndMerklerootParams,
} from '../models/poi-types';
import { shouldLogVerbose } from '../util/logging';
import {
  getBlockedShields,
  getLegacyTransactProofs,
  getMerkleProofs,
  getNodeStatus_ROUTE,
  getNodeStatusListKey,
  getPOIMerkletreeLeaves,
  getPOIsPerBlindedCommitment,
  getPOIsPerList,
  getPerformanceMetrics,
  getPoiEvents,
  getStatus,
  getTransactProofs,
  getValidatedTxid,
  removeTransactProof,
  submitLegacyTransactProofs,
  submitPOIEvent,
  submitSingleCommitmentProofs,
  submitTransactProof,
  submitValidatedTxidAndMerkleroot,
  validatePoiMerkleroots,
  validateTxidMerkleroot,
} from './route-logic';
import { LogicFunctionMap } from './json-rpc-handlers';

const dbg = debug('poi:api');

// Initialize the JSON schema validator
const validator = new Validator({ allErrors: true });

export class API {
  private app: express.Express;

  private server: Optional<Server>;

  private listKeys: string[];

  static debug = false;

  /**
   * Create a new API instance
   *
   * @param listKeys - List keys to use for the API
   */
  constructor(listKeys: string[]) {
    this.app = express();
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(
      cors({
        methods: ['GET', 'POST'],
        origin: '*',
      }),
    );
    this.addRoutes();

    this.listKeys = listKeys;

    // Error middleware for JSON validation errors
    this.app.use(
      (
        error: Error | unknown,
        req: Request,
        res: Response,
        next: NextFunction,
      ) => {
        console.log('inside error middleware');
        if (error instanceof ValidationError) {
          res
            .status(400)
            .send(
              `${
                error?.validationErrors?.body?.[0]?.message ??
                'Unknown validation error'
              }`,
            );
          return;
        }

        next(error);
      },
    );
  }

  /**
   * Start the API server
   *
   * @param host - Hostname to listen on
   * @param port - Port to listen on
   */
  serve(host: string, port: string) {
    if (this.server) {
      throw new Error('API is already running.');
    }
    this.server = this.app.listen(Number(port), host, () => {
      console.log(`Listening at http://${host}:${port}`);
      dbg(`Listening at http://${host}:${port}`);
    });
    this.server.on('error', err => {
      dbg(err);
    });
  }

  /**
   * Stop the API server
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    } else {
      dbg('Server was not running.');
    }
  }

  /**
   * Handle JSON RPC requests
   *
   * Acts as a dispatcher that routes JSON RPC requests to appropriate handlers based on
   * the method field in the request.
   *
   * @param req - Express request
   * @param res - Express response
   */
  private async handleJsonRpcRequest(req: Request, res: Response) {
    console.log('Received JSON RPC Request:', req.body);

    console.log('akjansdkjansd');

    // console.log('Before setting up logicFunctionMap, listKeys:', this.listKeys);

    // // Get method, params, and id from the request body
    const { method, params, id } = req.body;

    // Map of methods to their corresponding logic functions
    const logicFunctionMap: LogicFunctionMap = {
      'ppoi_node-status-v2': {
        logicFunction: async () => {
          console.log('Inside logicFunctionMap');

          return getNodeStatus_ROUTE(this.listKeys);
        }, // takes listKeys from constructor
        schema: null,
      },
      'ppoi_node-status-v2/:listKey': {
        logicFunction: async () => {
          return getNodeStatusListKey(params.listKey);
        }, // Gets listKey from req.body.params
        schema: null,
      },
      'ppoi_poi_events/:chainType/:chainID': {
        logicFunction: () =>
          getPoiEvents(
            req.params.chainType,
            req.params.chainID,
            params as GetPOIListEventRangeParams,
          ),
        schema: GetPOIListEventRangeBodySchema,
      },
      'ppoi_poi_merkletree_leaves/:chainType/:chainID': {
        logicFunction: () =>
          getPOIMerkletreeLeaves(
            req.params.chainType,
            req.params.chainID,
            params as GetPOIMerkletreeLeavesParams,
          ),
        schema: GetPOIMerkletreeLeavesBodySchema,
      },
    };

    // Check if the method is supported
    if (!logicFunctionMap[method]) {
      console.log('Method not found in logicFunctionMap:', method);

      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id,
      });
      return;
    }

    try {
      // Get the logic function and schema for the method
      const { logicFunction, schema } = logicFunctionMap[method];

      // Validate the params against the schema
      if (schema) validator.validate({ params: params, body: schema });

      // // print listkeys before call
      // console.log('listKeys', this.listKeys);

      // Execute the logic function
      const result = await logicFunction();
      console.log('Logic function result:', result);

      res.json({ jsonrpc: '2.0', result, id });
    } catch (error) {
      console.log('Error in handleJsonRpcRequest:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message },
        id,
      });
    }
  }

  /**
   * Basic auth middleware for protected routes
   *
   * Username and password are read from the BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD environment variables.
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   * @returns void
   */
  private basicAuth(req: Request, res: Response, next: NextFunction): void {
    const authorization = req.headers.authorization;

    // If no authorization header is present, return 401
    if (authorization == null || authorization == undefined) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if the authorization header is valid
    const base64Credentials = authorization.split(' ')[1] || '';
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
      'utf-8',
    );
    const [username, password] = credentials.split(':');

    if (
      username === process.env.BASIC_AUTH_USERNAME &&
      password === process.env.BASIC_AUTH_PASSWORD
    ) {
      return next();
    }

    res.status(401).json({ message: 'Unauthorized' });
  }

  /**
   * Safe GET handler that catches errors.
   *
   * If the API is running in list provider mode, the specific error message is returned to the client.
   * If the API is running in aggregator mode, a 500 response is returned without the error message.
   *
   * @param route - Route to handle GET requests for
   * @param handler - Request handler function that returns a Promise
   */
  private safeGet = <ReturnType>(
    route: string,
    handler: (req: Request) => Promise<ReturnType>,
  ) => {
    this.app.get(
      route,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (req: Request, res: Response, next: NextFunction) => {
        if (shouldLogVerbose()) {
          dbg(`GET request ${route}`);
          dbg({ ...req.params, ...req.body });
        }
        try {
          const value: ReturnType = await handler(req);
          return res.status(200).json(value);
        } catch (err) {
          if (API.debug) {
            // eslint-disable-next-line no-console
            console.error(err);
          }

          dbg(err);

          if (isListProvider()) {
            // Show the error message to aggregator nodes
            return res.status(500).json(err.message);
          } else {
            // Hide the error message
            return res.status(500).send();
          }
          // return next(err);
        }
      },
    );
  };

  /**
   * Safe POST handler that catches errors and returns a 500 response.
   *
   * @param route - Route to handle POST requests for
   * @param handler - Request handler function that returns a Promise
   * @param paramsSchema - JSON schema for request.params
   * @param bodySchema - JSON schema for request.body
   */
  private safePost = <ReturnType>(
    route: string,
    handler: (req: Request) => Promise<ReturnType>,
    paramsSchema: AllowedSchema,
    bodySchema: AllowedSchema,
  ) => {
    const validate = validator.validate({
      params: paramsSchema,
      body: bodySchema,
    });

    this.app.post(
      route,
      validate,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (req: Request, res: Response, next: NextFunction) => {
        dbg(`POST request ${route}`);
        dbg({ ...req.params, ...req.body });
        try {
          const value: ReturnType = await handler(req);
          if (isDefined(value)) {
            return res.status(200).json(value);
          }
          return res.status(200).send();
        } catch (err) {
          if (API.debug) {
            // eslint-disable-next-line no-console
            console.error(err);
          }

          dbg(err);

          let statusCode = 500;
          let errorMessage = 'Internal server error';

          if (err.message === 'Invalid listKey') {
            statusCode = 400;
            errorMessage = err.message;
          } else if (err.message === 'Cannot connect to listKey') {
            statusCode = 404;
            errorMessage = err.message;
          } else if (err.message === 'Invalid query range') {
            statusCode = 400;
            errorMessage = err.message;
          } else if (
            err.message ===
            `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`
          ) {
            statusCode = 400;
            errorMessage = err.message;
          } else if (
            err.message ===
            `Max event query range length is ${QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH}`
          ) {
            statusCode = 400;
            errorMessage = err.message;
          } else if (
            err.message ===
            `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`
          ) {
            statusCode = 400;
            errorMessage = err.message;
          } else if (
            err.message ===
            `Too many blinded commitments: max ${QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS}`
          ) {
            statusCode = 400;
            errorMessage = err.message;
          }

          if (isListProvider()) {
            // Show the error message to aggregator nodes
            return res.status(statusCode).json(errorMessage);
          } else {
            // Hide the error message
            return res.status(statusCode).send();
          }
          // return next(err);
        }
      },
    );
  };

  /**
   * Check if the listKey is valid
   *
   * @param listKey
   * @returns true if the listKey is valid
   */
  private hasListKey(listKey: string) {
    return this.listKeys.includes(listKey);
  }

  /**
   * Add all routes, for use in constructor
   */
  private addRoutes() {
    this.addStatusRoutes();
    this.addAggregatorRoutes();
    this.addClientRoutes();
  }

  /**
   * Add status routes
   */
  private addStatusRoutes() {
    /**
     * Status route GET /
     */
    this.app.get('/', (_req: Request, res: Response) => {
      res.json(getStatus());
    });

    /**
     * Status route POST /
     *
     * This binds the JSON RPC functionality to the base route.
     */
    this.app.post('/', this.handleJsonRpcRequest);

    /**
     * Performance route GET /perf, protected by basic auth
     */
    this.app.get('/perf', this.basicAuth, (_req: Request, res: Response) => {
      res.json(getPerformanceMetrics());
    });
  }

  private addAggregatorRoutes() {
    this.safeGet<NodeStatusAllNetworks>('/node-status-v2', async () => {
      console.log('Inside safeGet /node-status-v2');

      return getNodeStatus_ROUTE(this.listKeys);
    });

    this.safeGet<NodeStatusAllNetworks>(
      '/node-status-v2/:listKey',
      async (req: Request) => {
        // Extract listKey from request parameters
        const { listKey } = req.params;
        // Directly call the logic function with the extracted listKey
        return getNodeStatusListKey(listKey);
      },
    );

    // TODO:
    // this.safePost<NodeStatusAllNetworks>(
    //   '/node-status',
    //   async (req: Request) => {
    //     const { txidVersion } = req.body as NodeStatusParams;

    //     return NodeStatus.getNodeStatusAllNetworks(this.listKeys, txidVersion);
    //   },
    // );

    this.safePost<POISyncedListEvent[]>(
      '/poi-events/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as GetPOIListEventRangeParams;
        // Check if the listKey is valid
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        return getPoiEvents(req.params.chainType, req.params.chainID, body);
      },
      SharedChainTypeIDParamsSchema,
      GetPOIListEventRangeBodySchema,
    );

    this.safePost<string[]>(
      '/poi-merkletree-leaves/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as GetPOIMerkletreeLeavesParams;

        // Check if the listKey is valid
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        return await getPOIMerkletreeLeaves(
          req.params.chainType,
          req.params.chainID,
          body,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetPOIMerkletreeLeavesBodySchema,
    );

    this.safePost<TransactProofData[]>(
      '/transact-proofs/:chainType/:chainID',
      (req: Request) => {
        const body = req.body as GetTransactProofsParams;

        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        // safePOST requires a Promise to be returned
        return Promise.resolve(
          getTransactProofs(
            req.params.chainType,
            req.params.chainID,
            req.body as GetTransactProofsParams,
          ),
        );
      },
      SharedChainTypeIDParamsSchema,
      GetTransactProofsBodySchema,
    );

    this.safePost<LegacyTransactProofData[]>(
      '/legacy-transact-proofs/:chainType/:chainID',
      (req: Request) => {
        return Promise.resolve(
          getLegacyTransactProofs(
            req.params.chainType,
            req.params.chainID,
            req.body as GetLegacyTransactProofsParams,
          ),
        );
      },
      SharedChainTypeIDParamsSchema,
      GetLegacyTransactProofsBodySchema,
    );

    this.safePost<SignedBlockedShield[]>(
      '/blocked-shields/:chainType/:chainID',
      (req: Request) => {
        const body = req.body as GetBlockedShieldsParams;
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }

        return Promise.resolve(
          getBlockedShields(req.params.chainType, req.params.chainID, body),
        );
      },
      SharedChainTypeIDParamsSchema,
      GetBlockedShieldsBodySchema,
    );

    this.safePost<void>(
      '/submit-poi-event/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as SubmitPOIEventParams;
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        // Submit the POI event, return void
        await submitPOIEvent(
          req.params.chainType,
          req.params.chainID,
          body,
          dbg, // Pass in debugger for logging submitted signed POI events
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitPOIEventBodySchema,
    );

    this.safePost<void>(
      '/submit-validated-txid/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as SubmitValidatedTxidAndMerklerootParams;
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        await submitValidatedTxidAndMerkleroot(
          req.params.chainType,
          req.params.chainID,
          body,
          dbg, // Pass in debugger for logging submitted validated txids
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitValidatedTxidBodySchema,
    );

    this.safePost<void>(
      '/remove-transact-proof/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as RemoveTransactProofParams;

        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        await removeTransactProof(
          req.params.chainType,
          req.params.chainID,
          body,
          dbg,
        );
      },
      SharedChainTypeIDParamsSchema,
      RemoveTransactProofBodySchema,
    );
  }

  private addClientRoutes() {
    this.safePost<void>(
      '/submit-transact-proof/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as SubmitTransactProofParams;

        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        await submitTransactProof(
          req.params.chainType,
          req.params.chainID,
          body,
          dbg,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitTransactProofBodySchema,
    );

    this.safePost<void>(
      '/submit-legacy-transact-proofs/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as SubmitLegacyTransactProofParams;

        // Filter the listKeys to only include valid listKeys
        const filteredListKeys = body.listKeys.filter(listKey =>
          this.hasListKey(listKey),
        );

        // Modify body.listKeys to only include valid listKeys
        body.listKeys = filteredListKeys;

        // Submit the legacy transact proofs
        await submitLegacyTransactProofs(
          req.params.chainType,
          req.params.chainID,
          body,
          dbg,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitLegacyTransactProofsBodySchema,
    );

    this.safePost<void>(
      '/submit-single-commitment-proofs/:chainType/:chainID',
      async (req: Request) => {
        // Submit and verify the proofs
        await submitSingleCommitmentProofs(
          req.params.chainType,
          req.params.chainID,
          req.body as SubmitSingleCommitmentProofsParams,
          dbg,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitSingleCommitmentProofsBodySchema,
    );

    this.safePost<POIsPerListMap>(
      '/pois-per-list/:chainType/:chainID',
      (req: Request) => {
        return getPOIsPerList(
          req.params.chainType,
          req.params.chainID,
          req.body as GetPOIsPerListParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetPOIsPerListBodySchema,
    );

    this.safePost<POIsPerBlindedCommitmentMap>(
      '/pois-per-blinded-commitment/:chainType/:chainID',
      (req: Request) => {
        return getPOIsPerBlindedCommitment(
          req.params.chainType,
          req.params.chainID,
          req.body as GetPOIsPerBlindedCommitmentParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetPOIsPerBlindedCommitmentBodySchema,
    );

    this.safePost<MerkleProof[]>(
      '/merkle-proofs/:chainType/:chainID',
      async (req: Request) => {
        const body = req.body as GetMerkleProofsParams;

        // Check if the listKey is valid
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }
        return await getMerkleProofs(
          req.params.chainType,
          req.params.chainID,
          body,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetMerkleProofsBodySchema,
    );

    this.safePost<ValidatedRailgunTxidStatus>(
      '/validated-txid/:chainType/:chainID',
      async (req: Request) => {
        return await getValidatedTxid(
          req.params.chainType,
          req.params.chainID,
          req.body as GetLatestValidatedRailgunTxidParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetLatestValidatedRailgunTxidBodySchema,
    );

    this.safePost<boolean>(
      '/validate-txid-merkleroot/:chainType/:chainID',
      async (req: Request) => {
        return await validateTxidMerkleroot(
          req.params.chainType,
          req.params.chainID,
          req.body as ValidateTxidMerklerootParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      ValidateTxidMerklerootBodySchema,
    );

    this.safePost<boolean>(
      '/validate-poi-merkleroots/:chainType/:chainID',
      async (req: Request) => {
        return await validatePoiMerkleroots(
          req.params.chainType,
          req.params.chainID,
          req.body as ValidatePOIMerklerootsParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      ValidatePOIMerklerootsBodySchema,
    );
  }
}
