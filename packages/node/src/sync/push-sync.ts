import debug from 'debug';
import { Config } from '../config/config';

const dbg = debug('poi:push-sync');

export class PushSync {
  static sendNodeRequestToAllNodes = async (
    nodeRequest: (nodeURL: string) => Promise<void>,
  ) => {
    const requests = []
    for (const { nodeURL } of Config.NODE_CONFIGS) {
      requests.push(await this.sendNodeRequest(nodeURL, nodeRequest))
    }
    return requests;
  };

  static sendNodeRequest = async (
    nodeURL: string,
    nodeRequest: (nodeURL: string) => Promise<void>,
    shouldThrow = false,
  ) => {
    try {
      await nodeRequest(nodeURL);
    } catch (err) {
      dbg(err);
      if (shouldThrow) {
        throw err;
      }
    }
  };
}
