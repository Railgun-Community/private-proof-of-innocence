/// <reference types="../types/index" />
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import debug from 'debug';
import { Server, get } from 'http';
import {
  Validator,
  ValidationError,
  AllowedSchema,
} from 'express-json-validator-middleware';
import { POIEventList } from '../poi-events/poi-event-list';
import {
  isListProvider,
  networkNameForSerializedChain,
} from '../config/general';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
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
import { BlockedShieldsSyncer } from '../shields/blocked-shields-syncer';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';
import { SingleCommitmentProofManager } from '../single-commitment-proof/single-commitment-proof-manager';
import { shouldLogVerbose } from '../util/logging';
import {
  getNodeStatus,
  getNodeStatusListKey,
  getPerformanceMetrics,
  getPoiEvents,
  getStatus,
} from './route-logic';
import {
  LogicFunctionMap,
  formatJsonRpcError,
  validateParams,
} from './json-rpc-handlers';

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
      throw new Error('API already running.');
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
   * Check if the listKey is valid
   *
   * @param listKey
   * @returns true if the listKey is valid
   */
  private hasListKey(listKey: string) {
    return this.listKeys.includes(listKey);
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
  private handleJsonRpcRequest(req: Request, res: Response) {
    // Get method, params, and id from the request body
    const { method, params, id } = req.body;

    // Map of methods to their corresponding logic functions
    const logicFunctionMap: LogicFunctionMap = {
      'ppoi_node-status-v2': {
        logicFunction: () => getNodeStatus(this.listKeys), // takes listKeys from constructor
        schema: null,
      },
      'ppoi_node-status-v2/:listKey': {
        logicFunction: () => getNodeStatusListKey(params.listKey), // Gets listKey from req.body.params
        schema: null, // TODO: I believe this is null since it's not a POST request
      },
      // ppoi_perf: getPerformanceMetrics,
    };

    // Check if the method is supported using Object.prototype.hasOwnProperty.call
    if (!Object.prototype.hasOwnProperty.call(logicFunctionMap, method)) {
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
      validateParams(validator, params, schema);

      // Call the logic function and return the result
      logicFunction(params)
        .then(result => res.json({ jsonrpc: '2.0', result, id }))
        .catch(error =>
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message },
            id,
          }),
        );
    } catch (error) {
      res
        .status(400)
        .json({ jsonrpc: '2.0', error: formatJsonRpcError(error), id });
    }
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
    this.safeGet<NodeStatusAllNetworks>('/node-status-v2', () =>
      getNodeStatus(this.listKeys),
    );

    this.safeGet<NodeStatusAllNetworks>('/node-status-v2/:listKey', req => {
      // Extract listKey from request parameters
      const { listKey } = req.params;
      // Directly call the logic function with the extracted listKey
      return getNodeStatusListKey(listKey);
    });

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
        // Check if the listKey is valid
        if (!this.hasListKey(req.body.listKey)) {
          return [];
        }
        return getPoiEvents(req.params.chainType, req.params.chainID, req.body);
      },
      SharedChainTypeIDParamsSchema,
      GetPOIListEventRangeBodySchema,
    );

    this.safePost<string[]>(
      '/poi-merkletree-leaves/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, startIndex, endIndex } =
          req.body as GetPOIMerkletreeLeavesParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const rangeLength = endIndex - startIndex;
        if (
          rangeLength > QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH
        ) {
          throw new Error(
            `Max event query range length is ${QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH}`,
          );
        }
        if (rangeLength < 0) {
          throw new Error(`Invalid query range`);
        }

        const events = await POIMerkletreeManager.getPOIMerkletreeLeaves(
          listKey,
          networkName,
          txidVersion,
          startIndex,
          endIndex,
        );
        return events;
      },
      SharedChainTypeIDParamsSchema,
      GetPOIMerkletreeLeavesBodySchema,
    );

    this.safePost<TransactProofData[]>(
      '/transact-proofs/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, bloomFilterSerialized, listKey } =
          req.body as GetTransactProofsParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = TransactProofMempool.getFilteredProofs(
          listKey,
          networkName,
          txidVersion,
          bloomFilterSerialized,
        );
        return proofs;
      },
      SharedChainTypeIDParamsSchema,
      GetTransactProofsBodySchema,
    );

    this.safePost<LegacyTransactProofData[]>(
      '/legacy-transact-proofs/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, bloomFilterSerialized } =
          req.body as GetLegacyTransactProofsParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = LegacyTransactProofMempool.getFilteredProofs(
          networkName,
          txidVersion,
          bloomFilterSerialized,
        );
        return proofs;
      },
      SharedChainTypeIDParamsSchema,
      GetLegacyTransactProofsBodySchema,
    );

    this.safePost<SignedBlockedShield[]>(
      '/blocked-shields/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, bloomFilterSerialized, listKey } =
          req.body as GetBlockedShieldsParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = BlockedShieldsSyncer.getFilteredBlockedShields(
          txidVersion,
          listKey,
          networkName,
          bloomFilterSerialized,
        );
        return proofs;
      },
      SharedChainTypeIDParamsSchema,
      GetBlockedShieldsBodySchema,
    );

    this.safePost<void>(
      '/submit-poi-event/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, signedPOIEvent, validatedMerkleroot } =
          req.body as SubmitPOIEventParams;
        if (!this.hasListKey(listKey)) {
          return;
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        dbg(
          `REQUEST: Submit Signed POI Event: ${listKey}, ${signedPOIEvent.index}`,
        );

        // Submit and verify the proof
        await POIEventList.verifyAndAddSignedPOIEventsWithValidatedMerkleroots(
          listKey,
          networkName,
          txidVersion,
          [{ signedPOIEvent, validatedMerkleroot }],
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitPOIEventBodySchema,
    );

    this.safePost<void>(
      '/submit-validated-txid/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, txidIndex, merkleroot, signature, listKey } =
          req.body as SubmitValidatedTxidAndMerklerootParams;
        if (!this.hasListKey(listKey)) {
          return;
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        dbg(`REQUEST: Submit Validated TXID: ${txidIndex}`);

        // Submit and verify the proof
        await RailgunTxidMerkletreeManager.verifySignatureAndUpdateValidatedRailgunTxidStatus(
          networkName,
          txidVersion,
          txidIndex,
          merkleroot,
          signature,
          listKey,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitValidatedTxidBodySchema,
    );

    this.safePost<void>(
      '/remove-transact-proof/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const {
          txidVersion,
          listKey,
          blindedCommitmentsOut,
          railgunTxidIfHasUnshield,
          signature,
        } = req.body as RemoveTransactProofParams;
        if (!this.hasListKey(listKey)) {
          return;
        }

        const networkName = networkNameForSerializedChain(chainType, chainID);

        dbg(
          `REQUEST: Remove Transact Proof: ${listKey} - blindedCommitmentsOut ${blindedCommitmentsOut.join(
            ',',
          )} - railgunTxidIfHasUnshield ${railgunTxidIfHasUnshield}`,
        );

        await TransactProofMempoolPruner.removeProofSigned(
          listKey,
          networkName,
          txidVersion,
          blindedCommitmentsOut,
          railgunTxidIfHasUnshield,
          signature,
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
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, transactProofData } =
          req.body as SubmitTransactProofParams;
        if (!this.hasListKey(listKey)) {
          return;
        }

        const networkName = networkNameForSerializedChain(chainType, chainID);

        dbg(
          `REQUEST: Submit Transact Proof: ${listKey} - ${transactProofData.blindedCommitmentsOut.join(
            ', ',
          )}`,
        );

        // Submit and verify the proof
        await TransactProofMempool.submitProof(
          listKey,
          networkName,
          txidVersion,
          transactProofData,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitTransactProofBodySchema,
    );

    this.safePost<void>(
      '/submit-legacy-transact-proofs/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKeys, legacyTransactProofDatas } =
          req.body as SubmitLegacyTransactProofParams;

        const filteredListKeys = listKeys.filter(listKey =>
          this.hasListKey(listKey),
        );
        const networkName = networkNameForSerializedChain(chainType, chainID);

        dbg(
          `REQUEST: Submit Legacy Transact Proof: ${listKeys.join(
            ', ',
          )} - ${legacyTransactProofDatas
            .map(d => d.blindedCommitment)
            .join(', ')}`,
        );

        // Submit and verify the proofs
        await Promise.all(
          legacyTransactProofDatas.map(async legacyTransactProofData => {
            await LegacyTransactProofMempool.submitLegacyProof(
              networkName,
              txidVersion,
              legacyTransactProofData,
              filteredListKeys,
            );
          }),
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitLegacyTransactProofsBodySchema,
    );

    this.safePost<void>(
      '/submit-single-commitment-proofs/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, singleCommitmentProofsData } =
          req.body as SubmitSingleCommitmentProofsParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        dbg(
          `REQUEST: Submit Single Commitment (Transact) Proof: railgun txid ${singleCommitmentProofsData.railgunTxid}`,
        );

        // Submit and verify the proofs
        await SingleCommitmentProofManager.submitProof(
          networkName,
          txidVersion,
          singleCommitmentProofsData,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitSingleCommitmentProofsBodySchema,
    );

    this.safePost<POIsPerListMap>(
      '/pois-per-list/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKeys, blindedCommitmentDatas } =
          req.body as GetPOIsPerListParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        if (
          blindedCommitmentDatas.length >
          QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
          );
        }

        return POIMerkletreeManager.getPOIStatusPerList(
          listKeys,
          networkName,
          txidVersion,
          blindedCommitmentDatas,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetPOIsPerListBodySchema,
    );

    this.safePost<POIsPerBlindedCommitmentMap>(
      '/pois-per-blinded-commitment/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, blindedCommitmentDatas } =
          req.body as GetPOIsPerBlindedCommitmentParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        if (
          blindedCommitmentDatas.length >
          QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
          );
        }

        return POIMerkletreeManager.poiStatusPerBlindedCommitment(
          listKey,
          networkName,
          txidVersion,
          blindedCommitmentDatas,
        );
      },
      SharedChainTypeIDParamsSchema,
      GetPOIsPerBlindedCommitmentBodySchema,
    );

    this.safePost<MerkleProof[]>(
      '/merkle-proofs/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, blindedCommitments } =
          req.body as GetMerkleProofsParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);
        if (
          blindedCommitments.length >
          QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS}`,
          );
        }
        const merkleProofs = await POIMerkletreeManager.getMerkleProofs(
          listKey,
          networkName,
          txidVersion,
          blindedCommitments,
        );
        return merkleProofs;
      },
      SharedChainTypeIDParamsSchema,
      GetMerkleProofsBodySchema,
    );

    this.safePost<ValidatedRailgunTxidStatus>(
      '/validated-txid/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion } = req.body as GetLatestValidatedRailgunTxidParams;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const validatedRailgunTxidStatus =
          await RailgunTxidMerkletreeManager.getValidatedRailgunTxidStatus(
            networkName,
            txidVersion,
          );
        return validatedRailgunTxidStatus;
      },
      SharedChainTypeIDParamsSchema,
      GetLatestValidatedRailgunTxidBodySchema,
    );

    this.safePost<boolean>(
      '/validate-txid-merkleroot/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, tree, index, merkleroot } =
          req.body as ValidateTxidMerklerootParams;
        const networkName = networkNameForSerializedChain(chainType, chainID);
        const isValid =
          await RailgunTxidMerkletreeManager.checkIfMerklerootExists(
            networkName,
            txidVersion,
            tree,
            index,
            merkleroot,
          );
        return isValid;
      },
      SharedChainTypeIDParamsSchema,
      ValidateTxidMerklerootBodySchema,
    );

    this.safePost<boolean>(
      '/validate-poi-merkleroots/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, poiMerkleroots } =
          req.body as ValidatePOIMerklerootsParams;
        const networkName = networkNameForSerializedChain(chainType, chainID);
        const isValid =
          await POIMerkletreeManager.validateAllPOIMerklerootsExist(
            txidVersion,
            networkName,
            listKey,
            poiMerkleroots,
          );
        return isValid;
      },
      SharedChainTypeIDParamsSchema,
      ValidatePOIMerklerootsBodySchema,
    );
  }
}
