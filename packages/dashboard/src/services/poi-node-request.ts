import { NodeStatusAllNetworks } from '@railgun-community/shared-models';
import axios from 'axios';
import debug from 'debug';
import { AvailableNodes } from '@constants/nodes';

const dbg = debug('poi:request');

/*
 TODO: This file is a copy of packages/node/src/api/poi-node-request.ts it should be moved to a shared location
 Some changes has been made in this file, before deleting check changes.
*/

export class POINodeRequest {
  private static getNodeRouteURL = (
    url: AvailableNodes,
    route: string,
  ): string => {
    return `${url}/${route}`;
  };

  private static async getRequest<ResponseData>(
    url: string,
  ): Promise<ResponseData> {
    try {
      const { data }: { data: ResponseData } = await axios.get(url);
      return data;
    } catch (err) {
      const errMessage = err.message;
      dbg(`ERROR ${url} - ${errMessage}`);
      throw new Error(errMessage);
    }
  }

  static getNodeStatusAllNetworks = async (
    nodeURL: AvailableNodes,
  ): Promise<NodeStatusAllNetworks> => {
    let route = `node-status-v2`;

    // if (nodeURL === AvailableNodes.Local) {
    //   route = 'node-status';
    // }

    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const nodeStatusAllNetworks =
      await POINodeRequest.getRequest<NodeStatusAllNetworks>(url);
    return nodeStatusAllNetworks;
  };
}
