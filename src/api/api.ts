import express, { Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import debug from 'debug';
import { Server } from 'http';

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
    this.app.get('/list/:listKey/status', (_req: Request, res: Response) => {
      const status = res.json({ length: [] });
    });

    this.app.get('/list/:listKey/events', (req: Request, res: Response) => {
      // TODO: Query and return events in range.
      res.json({ events: [] });
    });
  }
}
