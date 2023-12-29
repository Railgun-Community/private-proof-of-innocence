import { TXIDVersion, isDefined } from '@railgun-community/shared-models';
import {
  networkNameForSerializedChain,
  nodeURLForListKey,
} from '../config/general';
import { NodeStatus } from '../status/node-status';
import { GetPOIListEventRangeParams } from '../models/poi-types';
import { POINodeRequest } from './poi-node-request';
import os from 'os';
import { QueryLimits } from '../config/query-limits';
import { POIEventList } from '../poi-events/poi-event-list';

/**
 * Logic for / route
 *
 * @returns Status object
 */
export const getStatus = () => {
  return { status: 'ok' };
};

export const getNodeStatus = (listKeys: string[]) => {
  return NodeStatus.getNodeStatusAllNetworks(
    listKeys,
    TXIDVersion.V2_PoseidonMerkle,
  );
};

export const getPerformanceMetrics = () => {
  return {
    time: new Date(),
    memoryUsage: process.memoryUsage(),
    freemem: os.freemem(),
    loadavg: os.loadavg(),
  };
};

/**
 * Get the node status for a listKey
 *
 * @param params - Params to validate from JSON RPC request
 * @returns Function that returns a promise of the node status
 */
export const getNodeStatusListKey = (listKey: string) => {
  const nodeURL = nodeURLForListKey(listKey);

  if (!isDefined(nodeURL)) {
    throw new Error('Cannot connect to listKey');
  }

  return POINodeRequest.getNodeStatusAllNetworks(nodeURL);
};

export const getPoiEvents = async (
  chainType: string,
  chainID: string,
  params: GetPOIListEventRangeParams,
) => {
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const rangeLength = params.endIndex - params.startIndex;
  if (rangeLength > QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH) {
    throw new Error(
      `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`,
    );
  }
  if (rangeLength < 0) {
    throw new Error(`Invalid query range`);
  }

  const events = await POIEventList.getPOIListEventRange(
    params.listKey,
    networkName,
    params.txidVersion,
    params.startIndex,
    params.endIndex,
  );
  return events;
};
