import express, { Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import { Config } from '../config/config';
import debug from 'debug';

const dbg = debug('poi:api');

const app = express();
app.use(express.json());

app.use(
  cors({
    methods: ['GET', 'POST'],
    origin: '*',
  }),
);

app.get('/profile', (_req: Request, res: Response) => {
  res.json({
    time: new Date(),
    memoryUsage: process.memoryUsage(),
    freemem: os.freemem(),
    loadavg: os.loadavg(),
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/status', async (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

const startExpressAPIServer = () => {
  app.listen(Number(Config.PORT), Config.HOST, () => {
    dbg(`Listening at http://${Config.HOST}:${Config.PORT}`);
  });
};

export { startExpressAPIServer };
