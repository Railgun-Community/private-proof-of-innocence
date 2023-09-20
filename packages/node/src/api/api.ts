import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import os from "os";
import debug from "debug";
import { Server } from "http";
import {
  Validator,
  ValidationError,
  AllowedSchema,
} from "express-json-validator-middleware";
import { POIEventList } from "../poi-events/poi-event-list";
import { networkNameForSerializedChain } from "../config/general";
import { TransactProofMempool } from "../proof-mempool/transact-proof-mempool";
import { POIMerkletreeManager } from "../poi-events/poi-merkletree-manager";
import { getShieldQueueStatus } from "../shields/shield-queue";
import { RailgunTxidMerkletreeManager } from "../railgun-txids/railgun-txid-merkletree-manager";
import { QueryLimits } from "../config/query-limits";
import { NodeStatus } from "../status/node-status";
import { Config } from "../config/config";
import {
  NodeStatusAllNetworks,
  GetTransactProofsParams,
  GetBlockedShieldsParams,
  SubmitTransactProofParams,
  GetPOIsPerListParams,
  GetMerkleProofsParams,
  ValidateTxidMerklerootParams,
} from "@railgun-community/shared-models";
import {
  GetTransactProofsParamsSchema,
  GetTransactProofsBodySchema,
  SubmitTransactProofBodySchema,
  SubmitTransactProofParamsSchema,
  GetPOIsPerListBodySchema,
  GetPOIsPerListParamsSchema,
  GetMerkleProofsParamsSchema,
  GetMerkleProofsBodySchema,
  ValidateTxidMerklerootBodySchema,
  ValidateTxidMerklerootParamsSchema,
  GetBlockedShieldsBodySchema,
  GetBlockedShieldsParamsSchema,
} from "./schemas";

const dbg = debug("poi:api");

// Initialize the JSON schema validator
const validator = new Validator({ allErrors: true });

export class API {
  private app: express.Express;

  private server: Optional<Server>;

  constructor() {
    this.app = express();
    this.app.use(express.json({ limit: "5mb" }));
    this.app.use(
      cors({
        methods: ["GET", "POST"],
        origin: "*",
      })
    );
    this.addRoutes();

    // Error middleware for JSON validation errors
    this.app.use(
      (error: any, req: Request, res: Response, next: NextFunction) => {
        if (error instanceof ValidationError) {
          res.status(400).send(error.validationErrors);
        } else {
          next(error);
        }
      }
    );
  }

  serve(host: string, port: string) {
    if (this.server) {
      throw new Error("API already running.");
    }
    this.server = this.app.listen(Number(port), host, () => {
      dbg(`Listening at http://${host}:${port}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    } else {
      dbg("Server was not running.");
    }
  }

  private safeGet(
    route: string,
    handler: (req: Request, res: Response) => Promise<void>
  ) {
    this.app.get(route, async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (err) {
        // TODO: Remove err message
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        res.status(500).json(err.message);
      }
    });
  }

  /**
   * Safe POST handler that catches errors and returns a 500 response.
   *
   * @param route - Route to handle POST requests for
   * @param handler - Request handler function that returns a Promise
   * @param schema - JSON schema for the request body
   */
  private safePost(
    route: string,
    handler: (req: Request, res: Response) => Promise<void>,
    paramsSchema: AllowedSchema,
    bodySchema: AllowedSchema
  ) {
    const validate = validator.validate({
      params: paramsSchema,
      body: bodySchema,
    });

    this.app.post(
      route,
      validate,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          await handler(req, res);
          return res.status(200).send(); // Explicitly return a value
        } catch (err) {
          return next(err);
        }
      }
    );
  }

  private assertHasListKey(listKey: string) {
    if (!Config.LIST_KEYS.includes(listKey)) {
      throw new Error("Missing listKey");
    }
  }

  private addRoutes() {
    this.addStatusRoutes();
    this.addAggregatorRoutes();
    this.addClientRoutes();
  }

  private addStatusRoutes() {
    this.app.get("/", (_req: Request, res: Response) => {
      res.json({ status: "ok" });
    });

    this.app.get("/perf", (_req: Request, res: Response) => {
      res.json({
        time: new Date(),
        memoryUsage: process.memoryUsage(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
      });
    });
  }

  private addAggregatorRoutes() {
    this.safeGet("/node-status", async (req: Request, res: Response) => {
      const nodeStatusAllNetworks: NodeStatusAllNetworks =
        await NodeStatus.getNodeStatusAllNetworks();
      res.json(nodeStatusAllNetworks);
    });

    this.safeGet(
      "/shield-queue-status/:chainType/:chainID",
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const status = await getShieldQueueStatus(networkName);
        res.json(status);
      }
    );

    this.safeGet(
      "/list-status/:chainType/:chainID/:listKey",
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey } = req.params;
        this.assertHasListKey(listKey);
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const status = await POIEventList.getPOIEventsLength(
          networkName,
          listKey
        );
        res.json(status);
      }
    );

    this.safeGet(
      "/poi-events/:chainType/:chainID/:listKey/:startIndex/:endIndex",
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey, startIndex, endIndex } =
          req.params;
        this.assertHasListKey(listKey);
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const start = Number(startIndex);
        const end = Number(endIndex);
        const rangeLength = end - start;
        if (rangeLength > QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH) {
          throw new Error(
            `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`
          );
        }
        if (rangeLength < 0) {
          throw new Error(`Invalid query range`);
        }

        const events = await POIEventList.getPOIListEventRange(
          networkName,
          listKey,
          start,
          end
        );
        res.json(events);
      }
    );

    this.safePost(
      "/transact-proofs/:chainType/:chainID/:listKey",
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey } = req.params;
        const { bloomFilterSerialized } = req.body as GetTransactProofsParams;
        this.assertHasListKey(listKey);

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = TransactProofMempool.getFilteredProofs(
          listKey,
          networkName,
          bloomFilterSerialized
        );
        res.json(proofs);
      },
      GetTransactProofsParamsSchema,
      GetTransactProofsBodySchema
    );

    this.safePost(
      '/blocked-shields/:chainType/:chainID/:listKey',
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey } = req.params;
        const { bloomFilterSerialized } = req.body as GetBlockedShieldsParams;
        this.assertHasListKey(listKey);

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = TransactProofMempool.getFilteredProofs(
          listKey,
          networkName,
          bloomFilterSerialized,
        );
        res.json(proofs);
      },
      GetBlockedShieldsParamsSchema,
      GetBlockedShieldsBodySchema
    );
  }

  private addClientRoutes() {
    this.safePost(
      "/submit-transact-proof/:chainType/:chainID",
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKey, transactProofData } =
          req.body as SubmitTransactProofParams;
        this.assertHasListKey(listKey);
        const networkName = networkNameForSerializedChain(chainType, chainID);

        // Submit and verify the proof
        await TransactProofMempool.submitProof(
          listKey,
          networkName,
          transactProofData
        );
        res.status(200);
      },
      SubmitTransactProofParamsSchema,
      SubmitTransactProofBodySchema
    );

    this.safePost(
      "/pois-per-list/:chainType/:chainID",
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKeys, blindedCommitmentDatas } =
          req.body as GetPOIsPerListParams;
        listKeys.forEach((listKey) => {
          this.assertHasListKey(listKey);
        });
        const networkName = networkNameForSerializedChain(chainType, chainID);

        if (
          blindedCommitmentDatas.length >
          QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`
          );
        }
        const poiStatusMap = await POIMerkletreeManager.getPOIStatusPerList(
          listKeys,
          networkName,
          blindedCommitmentDatas
        );
        res.json(poiStatusMap);
      },
      GetPOIsPerListParamsSchema,
      GetPOIsPerListBodySchema
    );

    this.safePost(
      "/merkle-proofs/:chainType/:chainID",
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { listKey, blindedCommitments } =
          req.body as GetMerkleProofsParams;
        this.assertHasListKey(listKey);
        const networkName = networkNameForSerializedChain(chainType, chainID);
        if (
          blindedCommitments.length >
          QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS}`
          );
        }
        const merkleProofs = await POIMerkletreeManager.getMerkleProofs(
          listKey,
          networkName,
          blindedCommitments
        );
        res.json(merkleProofs);
      },
      GetMerkleProofsParamsSchema,
      GetMerkleProofsBodySchema
    );

    this.safeGet(
      "/validated-txid/:chainType/:chainID",
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const networkName = networkNameForSerializedChain(chainType, chainID);
        const validatedRailgunTxidStatus =
          RailgunTxidMerkletreeManager.getValidatedRailgunTxidStatus(
            networkName
          );
        res.json(validatedRailgunTxidStatus);
      }
    );

    this.safePost(
      "/validate-txid-merkleroot/:chainType/:chainID",
      async (req: Request, res: Response) => {
        const { chainType, chainID } = req.params;
        const { tree, index, merkleroot } =
          req.body as ValidateTxidMerklerootParams;
        const networkName = networkNameForSerializedChain(chainType, chainID);
        const isValid =
          await RailgunTxidMerkletreeManager.checkIfMerklerootExists(
            networkName,
            tree,
            index,
            merkleroot
          );
        res.json(isValid);
      },
      ValidateTxidMerklerootParamsSchema,
      ValidateTxidMerklerootBodySchema
    );
  }
}
