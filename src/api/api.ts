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
      '/list/:chainType/:chainID/:listKey/status',
      async (req: Request, res: Response) => {
        const { chainType, chainID, listKey } = req.params;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const status = await getEventListStatus(networkName, listKey);
        res.json(status);
      },
    );

    this.safeGet(
      '/list/:chainType/:chainID/:listKey/events/:startIndex/:endIndex',
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
        res.json({ events });
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
}
