import debug from 'debug';
import { Config } from '../config/config';

const dbg = debug('poi:push-sync');

export class PushSync {
  static sendNodeRequestToAllNodes = (
    nodeRequest: (nodeURL: string) => Promise<void>,
  ) => {
    return Promise.all(
      Config.NODE_CONFIGS.map(async ({ nodeURL }) => {
        await this.sendNodeRequest(nodeURL, nodeRequest);
      }),
    );
  };

  static sendNodeRequest = async (
    nodeURL: string,
    nodeRequest: (nodeURL: string) => Promise<void>,
  ) => {
    try {
      await nodeRequest(nodeURL);
    } catch (err) {
      dbg(err);
      return;
    }
  };
}
