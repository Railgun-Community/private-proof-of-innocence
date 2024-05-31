/**
 * @description API module for the Proof of Innocence node
 *
 * @note Supports both JSON-RPC and REST API
 * @note Logic is shared between the JSON-RPC and REST API, from route-logic.ts
 * @note HTTP error handling is shared between JSON-RPC and REST API, from route-logic.ts
 * @note Schema validation is defined in schemas.ts.
 */
/// <reference types="../types/index" />
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import debug from 'debug';
import { Server } from 'http';
import {
  Validator,
  AllowedSchema,
  ValidationError,
} from 'express-json-validator-middleware';
import { isListProvider } from '../config/general';
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
  validatePoiMerkleroots,
  validateTxidMerkleroot,
  handleHTTPError,
  submitValidatedTxid,
  paramToNumber,
} from './route-logic';
import { getLogicFunctionMap } from './json-rpc-handlers';
import { error } from 'console';

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
    // Bind (this) to the JSON-RPC request handler function
    this.handleJsonRpcRequest = this.handleJsonRpcRequest.bind(this);

    this.addRoutes();

    this.listKeys = listKeys;

    // Catch errors thrown by each JSON schema validator used in JSON-RPC and REST flows
    this.app.use(
      (
        error: Error | unknown,
        req: Request,
        res: Response,
        next: NextFunction,
      ) => {
        if (error instanceof ValidationError) {
          if (req.path === '/') {
            // JSON-RPC validation error
            res.status(400).json({
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Invalid params',
                data: error.validationErrors,
              },
              id: req.body.id,
            });
          } else {
            // REST validation error
            res
              .status(400)
              .send(
                `${
                  error?.validationErrors?.body?.[0]?.message ??
                  'Unknown validation error'
                }`,
              );
          }
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
   * @returns void
   * @throws Error if the method is not supported
   * @throws Error if the params are invalid
   * @throws Error if the logic function throws an error
   */
  private async handleJsonRpcRequest(req: Request, res: Response) {
    const { method, params, id } = req.body;

    // Get the logic functions
    const logicFunctionMap = getLogicFunctionMap(params, this.listKeys, dbg);

    // Check if the method is supported
    if (!Object.prototype.hasOwnProperty.call(logicFunctionMap, method)) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id,
      });
      return;
    }

    // Check validity of listKey if one is passed in for the respective method
    if (Boolean(params.listKey) && !this.hasListKey(params.listKey)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'Invalid listKey',
        },
        id,
      });
      return;
    }

    // Execute the requested method
    try {
      const { logicFunction, schema } = logicFunctionMap[method];

      // Manually validate params/schema since validation package isn't compatible with JSON-RPC
      if (schema) {
        const validateResult = validator.ajv.validate(schema, params);

        if (!validateResult) {
          // Validation failed, handle error response
          const errors = validator.ajv.errors;

          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Invalid params', data: errors },
            id,
          });
          return;
        }
      }

      // Execute the logic function
      const result = await logicFunction();
      res.json({ jsonrpc: '2.0', result, id });
    } catch (error) {
      const { statusCode, errorMessage } = handleHTTPError(error);
      const jsonRpcErrorCode = statusCode === 400 ? -32602 : -32603;

      // Respond with error
      if (isListProvider()) {
        // Show the error message to aggregator nodes
        res.status(statusCode).json({
          jsonrpc: '2.0',
          error: { code: jsonRpcErrorCode, message: errorMessage },
          id,
        });
      } else {
        // Hide the error message for client nodes
        res.status(statusCode).json({
          jsonrpc: '2.0',
          error: {
            code: jsonRpcErrorCode,
            message: 'Error occurred while executing the JSON-RPC method',
          },
          id,
        });
      }
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
   * Safe GET handler that catches REST errors.
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
      async (req: Request, res: Response) => {
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
            return res.status(500).json({ error: err.message });
          } else {
            // Hide the error message
            return res.status(500).json({
              error: 'Error occurred while executing the REST method',
            });
          }
        }
      },
    );
  };

  /**
   * Safe POST handler that catches REST errors and returns a 500 response.
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
    const validateMiddleware = validator.validate({
      params: paramsSchema,
      body: bodySchema,
    });

    this.app.post(
      route,
      validateMiddleware,
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

          // Use the shared error handling function
          const { statusCode, errorMessage } = handleHTTPError(err);

          if (isListProvider()) {
            return res.status(statusCode).send(errorMessage);
          } else {
            return res
              .status(statusCode)
              .send('Error occurred while executing the REST method');
          }
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
        console.log('req.body', req.body);
        console.log('req.params', req.params);

        const body = req.body as GetPOIListEventRangeParams;
        // Check if listKey is valid
        if (!this.hasListKey(body.listKey)) {
          throw new Error('Invalid listKey');
        }

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return getPoiEvents(chainType, chainID, body);
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return await getPOIMerkletreeLeaves(chainType, chainID, body);
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        // safePOST requires a Promise to be returned
        return Promise.resolve(
          getTransactProofs(
            chainType,
            chainID,
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
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return Promise.resolve(
          getLegacyTransactProofs(
            chainType,
            chainID,
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return Promise.resolve(getBlockedShields(chainType, chainID, body));
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        // Submit the POI event, return void
        await submitPOIEvent(
          chainType,
          chainID,
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        await submitValidatedTxid(
          chainType,
          chainID,
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        await removeTransactProof(chainType, chainID, body, dbg);
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        await submitTransactProof(chainType, chainID, body, dbg);
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        // Submit the legacy transact proofs
        await submitLegacyTransactProofs(chainType, chainID, body, dbg);
      },
      SharedChainTypeIDParamsSchema,
      SubmitLegacyTransactProofsBodySchema,
    );

    this.safePost<void>(
      '/submit-single-commitment-proofs/:chainType/:chainID',
      async (req: Request) => {
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        // Submit and verify the proofs
        await submitSingleCommitmentProofs(
          chainType,
          chainID,
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
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return getPOIsPerList(
          chainType,
          chainID,
          req.body as GetPOIsPerListParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetPOIsPerListBodySchema,
    );

    this.safePost<POIsPerBlindedCommitmentMap>(
      '/pois-per-blinded-commitment/:chainType/:chainID',
      (req: Request) => {
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return getPOIsPerBlindedCommitment(
          chainType,
          chainID,
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

        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return await getMerkleProofs(chainType, chainID, body);
      },
      SharedChainTypeIDParamsSchema,
      GetMerkleProofsBodySchema,
    );

    this.safePost<ValidatedRailgunTxidStatus>(
      '/validated-txid/:chainType/:chainID',
      async (req: Request) => {
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return await getValidatedTxid(
          chainType,
          chainID,
          req.body as GetLatestValidatedRailgunTxidParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetLatestValidatedRailgunTxidBodySchema,
    );

    this.safePost<boolean>(
      '/validate-txid-merkleroot/:chainType/:chainID',
      async (req: Request) => {
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return await validateTxidMerkleroot(
          chainType,
          chainID,
          req.body as ValidateTxidMerklerootParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      ValidateTxidMerklerootBodySchema,
    );

    this.safePost<boolean>(
      '/validate-poi-merkleroots/:chainType/:chainID',
      async (req: Request) => {
        const chainType = paramToNumber(req.params.chainType);
        const chainID = paramToNumber(req.params.chainID);

        return await validatePoiMerkleroots(
          chainType,
          chainID,
          req.body as ValidatePOIMerklerootsParams,
        );
      },
      SharedChainTypeIDParamsSchema,
      ValidatePOIMerklerootsBodySchema,
    );
  }
}
