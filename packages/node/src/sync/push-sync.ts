import debug from 'debug';
import { nodeURLForListKey } from '../config/general';
import { isDefined } from '@railgun-community/shared-models';

const dbg = debug('poi:push-sync');

export class PushSync {
  private static listKeys: string[] = [];

  static init(listKeys: string[]) {
    PushSync.listKeys = listKeys;
  }

  static sendNodeRequestToAllLists = (
    nodeRequest: (nodeURL: string) => Promise<void>,
  ) => {
    return Promise.all(
      this.listKeys.map(async listKey => {
        await this.sendNodeRequestToList(listKey, nodeRequest);
      }),
    );
  };

  static sendNodeRequestToList = async (
    listKey: string,
    nodeRequest: (nodeURL: string) => Promise<void>,
  ) => {
    const nodeURL = nodeURLForListKey(listKey);
    if (!isDefined(nodeURL)) {
      return;
    }
    try {
      await nodeRequest(nodeURL);
    } catch (err) {
      dbg(err);
      return;
    }
  };
}
