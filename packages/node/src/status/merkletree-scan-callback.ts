/* eslint-disable @typescript-eslint/no-unused-vars */
import { MerkletreeScanUpdateEvent } from '@railgun-community/shared-models';
import debug from 'debug';

const dbg = debug('poi:engine-scan');

export const onUTXOMerkletreeScanCallback = ({
  chain,
  scanStatus,
  progress,
}: MerkletreeScanUpdateEvent) => {
  // dbg(chain, scanStatus, progress);
};

export const onTXIDMerkletreeScanCallback = ({
  chain,
  scanStatus,
  progress,
}: MerkletreeScanUpdateEvent) => {
  // dbg(chain, scanStatus, progress);
};
