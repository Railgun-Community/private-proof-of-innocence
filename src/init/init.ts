import debug from 'debug';
import { startEngine, stopEngine } from '../engine/engine-init';
import { initNetworkProviders } from '../rpc-providers/active-network-providers';
import { setOnMerkletreeScanCallback } from '@railgun-community/wallet';
import { onMerkletreeScanCallback } from '../status/merkletree-scan-callback';
import { DatabaseClient } from '../database/database-client-init';
import { ShieldProofMempool } from '../proof-mempool/shield-proof-mempool';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { POIMerkletreeManager } from '../poi/poi-merkletree-manager';
import { SyncRoundRobin } from '../sync/sync-round-robin';

const dbg = debug('poi:init');

export const initModules = async (connectedNodeURLs: string[]) => {
  // Init engine and RPCs
  dbg('Initializing Engine and RPCs...');
  startEngine();
  await initNetworkProviders();
  setOnMerkletreeScanCallback(onMerkletreeScanCallback);

  dbg('Setting up databases...');
  await DatabaseClient.init();
  await DatabaseClient.ensureDBIndicesAllChains();

  dbg('Inflating Shield Proof mempool cache...');
  await ShieldProofMempool.inflateCacheFromDatabase();

  dbg('Inflating Transact Proof mempool cache...');
  await TransactProofMempool.inflateCacheFromDatabase();

  dbg('Generating POI Merkletrees for each list and network...');
  POIMerkletreeManager.initListMerkletrees();

  dbg('Starting round robin node sync...');
  connectedNodeURLs.forEach((nodeURL) => {
    SyncRoundRobin.addNodeURL(nodeURL);
  });
  SyncRoundRobin.startPolling();

  dbg('Node init successful.');
};

export const uninitModules = async () => {
  await stopEngine();
};
