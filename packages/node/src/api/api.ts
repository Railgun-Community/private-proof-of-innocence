/// <reference types="../types/index" />
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import debug from 'debug';
import { Server } from 'http';
import {
  Validator,
  ValidationError,
  AllowedSchema,
} from 'express-json-validator-middleware';
import { POIEventList } from '../poi-events/poi-event-list';
import {
  isListProvider,
  networkNameForSerializedChain,
  nodeURLForListKey,
} from '../config/general';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../config/query-limits';
import { NodeStatus } from '../status/node-status';
import {
  NodeStatusAllNetworks,
  GetTransactProofsParams,
  GetBlockedShieldsParams,
  SubmitTransactProofParams,
  GetPOIsPerListParams,
  GetMerkleProofsParams,
  ValidateTxidMerklerootParams,
  GetLatestValidatedRailgunTxidParams,
  TXIDVersion,
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
import { POINodeRequest } from './poi-node-request';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';
import { SingleCommitmentProofManager } from '../single-commitment-proof/single-commitment-proof-manager';
import { shouldLogVerbose } from '../util/logging';

const dbg = debug('poi:api');

// Initialize the JSON schema validator
const validator = new Validator({ allErrors: true });

export class API {
  private app: express.Express;

  private server: Optional<Server>;

  private listKeys: string[];

  static debug = false;

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

  stop() {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    } else {
      dbg('Server was not running.');
    }
  }

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

  private hasListKey(listKey: string) {
    return this.listKeys.includes(listKey);
  }

  private addRoutes() {
    this.addStatusRoutes();
    this.addAggregatorRoutes();
    this.addClientRoutes();
  }

  private addStatusRoutes() {
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/perf', this.basicAuth, (_req: Request, res: Response) => {
      res.json({
        time: new Date(),
        memoryUsage: process.memoryUsage(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
      });
    });
  }

  private addAggregatorRoutes() {
    this.safeGet<NodeStatusAllNetworks>('/node-status-v2', async () => {
      return NodeStatus.getNodeStatusAllNetworks(
        this.listKeys,
        TXIDVersion.V2_PoseidonMerkle,
      );
    });

    this.safeGet<NodeStatusAllNetworks>(
      '/node-status-v2/:listKey',
      async (req: Request) => {
        const { listKey } = req.params;
        req.body as GetPOIListEventRangeParams;
        const nodeURL = nodeURLForListKey(listKey);
        if (!isDefined(nodeURL)) {
          throw new Error('Cannot connect to listKey');
        }
        return POINodeRequest.getNodeStatusAllNetworks(nodeURL);
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
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, startIndex, endIndex } =
          req.body as GetPOIListEventRangeParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const rangeLength = endIndex - startIndex;
        if (rangeLength > QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH) {
          throw new Error(
            `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`,
          );
        }
        if (rangeLength < 0) {
          throw new Error(`Invalid query range`);
        }

        const events = await POIEventList.getPOIListEventRange(
          listKey,
          networkName,
          txidVersion,
          startIndex,
          endIndex,
        );
        return events;
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
