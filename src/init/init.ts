import debug from 'debug';
import { startEngine, stopEngine } from '../engine/engine-init';
import { initNetworkProviders } from '../rpc-providers/active-network-providers';
import { setOnMerkletreeScanCallback } from '@railgun-community/wallet';
import { onMerkletreeScanCallback } from '../status/merkletree-scan-callback';
import { DatabaseClient } from '../database/database-client';
import { ShieldProofMempool } from '../proof-mempool/shield-proof-mempool';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';

const dbg = debug('poi:init');

export const initModules = async () => {
  // Init engine and RPCs
  dbg('Initializing Engine and RPCs...');
  startEngine();
  await initNetworkProviders();

  dbg('Setting up databases...');
  await DatabaseClient.init();
  await DatabaseClient.ensureDBIndicesAllChains();

  dbg('Inflating Shield Proof mempool cache...');
  await ShieldProofMempool.inflateCacheFromDatabase();

  dbg('Inflating Transact Proof mempool cache...');
  await TransactProofMempool.inflateCacheFromDatabase();

  setOnMerkletreeScanCallback(onMerkletreeScanCallback);

  dbg('Node init successful.');
};

export const uninitModules = async () => {
  await stopEngine();
};
