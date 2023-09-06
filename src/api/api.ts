import express, { Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import debug from 'debug';
import { Server } from 'http';
import {
  getEventListStatus,
  getPOIListEventRange,
} from '../poi/poi-event-list';
import { networkNameForSerializedChain } from '../config/general';
import { ShieldProofMempool } from '../proof-mempool/shield-proof-mempool';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import {
  GetMerkleProofsParams,
  GetPOIsPerListParams,
  GetShieldProofsParams,
  GetTransactProofsParams,
  SubmitShieldProofParams,
  SubmitTransactProofParams,
} from '../models/api-types';
import { POILookup } from '../poi/poi-lookup';
import { POIMerkletreeManager } from '../poi/poi-merkletree-manager';
import { getShieldQueueStatus } from '../shield-queue/shield-queue';

const dbg = debug('poi:api');

export class API {
  private app: express.Express;

  private server: Optional<Server>;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(
      cors({
        methods: ['GET', 'POST'],
        origin: '*',
      }),
    );
    this.addRoutes();
  }

  serve(host: string, port: string) {
    if (this.server) {
      throw new Error('API already running.');
    }
    this.server = this.app.listen(Number(port), host, () => {
      dbg(`Listening at http://${host}:${port}`);
    });
  }

  stop() {
    this.server?.close();
    this.server = undefined;
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

    this.app.get('/perf', (_req: Request, res: Response) => {
      res.json({
        time: new Date(),
        memoryUsage: process.memoryUsage(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
      });
    });
  }

  private addAggregatorRoutes() {
    this.safeGet(
      '/shield-queue-status/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const status = await getShieldQueueStatus(networkName);
        res.json(status);
      },
    );

    this.safeGet(
      '/list-status/:chainType/:chainID/:listKey',
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey } = req.params;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const status = await getEventListStatus(networkName, listKey);
        res.json(status);
      },
    );

    this.safeGet(
      '/poi-events/:chainType/:chainID/:listKey/:startIndex/:endIndex',
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey, startIndex, endIndex } =
          req.params;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const events = await getPOIListEventRange(
          networkName,
          listKey,
          Number(startIndex),
          Number(endIndex),
        );
        res.json(events);
      },
    );

    this.safeGet(
      '/shield-proofs/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { bloomFilterSerialized } = req.body as GetShieldProofsParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = ShieldProofMempool.getFilteredProofs(
          networkName,
          bloomFilterSerialized,
        );
        res.json(proofs);
      },
    );

    this.safeGet(
      '/transact-proofs/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKey, bloomFilterSerialized } =
          req.body as GetTransactProofsParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = TransactProofMempool.getFilteredProofs(
          listKey,
          networkName,
          bloomFilterSerialized,
        );
        res.json(proofs);
      },
    );
  }

  private addClientRoutes() {
    this.safePost(
      '/submit-shield-proof/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { shieldProofData } = req.body as SubmitShieldProofParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        await ShieldProofMempool.submitProof(networkName, shieldProofData);
        res.status(200);
      },
    );

    this.safePost(
      '/submit-transact-proof/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKey, transactProofData } =
          req.body as SubmitTransactProofParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        await TransactProofMempool.submitProof(
          listKey,
          networkName,
          transactProofData,
        );
        res.status(200);
      },
    );

    this.safeGet(
      '/pois-per-list/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKeys, blindedCommitment } =
          req.body as GetPOIsPerListParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const poiExistenceMap = await POILookup.getPOIExistencePerList(
          listKeys,
          networkName,
          blindedCommitment,
        );
        res.json(poiExistenceMap);
      },
    );

    this.safeGet(
      '/merkle-proofs/:chainType/:chainID',
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKey, blindedCommitments } =
          req.body as GetMerkleProofsParams;

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const merkleProofs = await POIMerkletreeManager.getMerkleProofs(
          listKey,
          networkName,
          blindedCommitments,
        );
        res.json(merkleProofs);
      },
    );
  }

  private safeGet(
    route: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) {
    this.app.get(route, async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        res.status(500).json({ error: err.message });
      }
    });
  }

  private safePost(
    route: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) {
    this.app.get(route, async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        res.status(500).json({ error: err.message });
      }
    });
  }
}
