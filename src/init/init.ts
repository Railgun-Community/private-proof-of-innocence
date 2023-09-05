import debug from 'debug';
import { startEngine, stopEngine } from '../engine/engine-init';
import { initNetworkProviders } from '../rpc-providers/active-network-providers';
import { setOnMerkletreeScanCallback } from '@railgun-community/wallet';
import { onMerkletreeScanCallback } from '../status/merkletree-scan-callback';
import { DatabaseClient } from '../database/database-client';

const dbg = debug('poi:init');

export const initModules = async () => {
  // Init engine and RPCs
  startEngine();
  await initNetworkProviders();

  // Set up mongo databases
  await DatabaseClient.init();
  await DatabaseClient.ensureDBIndicesAllChains();

  setOnMerkletreeScanCallback(onMerkletreeScanCallback);

  dbg('Node init successful.');
};

export const uninitModules = async () => {
  await stopEngine();
};
