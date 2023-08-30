import { MerkletreeScanUpdateEvent } from '@railgun-community/shared-models';
import debug from 'debug';

const dbg = debug('poi:engine-scan');

export const onMerkletreeScanCallback = ({
  chain,
  scanStatus,
  progress,
}: MerkletreeScanUpdateEvent) => {
  dbg(chain, scanStatus, progress);
};
