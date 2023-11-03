import debug from 'debug';
import { startEngine } from '../engine/engine-init';
import { initNetworkProviders } from '../rpc-providers/active-network-providers';
import {
  getEngine,
  getTXIDMerkletreeForNetwork,
  resetFullTXIDMerkletrees,
  setOnTXIDMerkletreeScanCallback,
  setOnUTXOMerkletreeScanCallback,
} from '@railgun-community/wallet';
import {
  onUTXOMerkletreeScanCallback,
  onTXIDMerkletreeScanCallback,
} from '../status/merkletree-scan-callback';
import { DatabaseClient } from '../database/database-client-init';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { BlockedShieldsSyncer } from '../shields/blocked-shields-syncer';
import { Config } from '../config/config';
import { chainForNetwork } from '../config/general';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';

const dbg = debug('poi:init');

export const initDatabases = async () => {
  dbg('Setting up databases...');
  await DatabaseClient.init();
  await DatabaseClient.ensureDBIndicesAllChains();
};

export const initEngineAndScanTXIDs = async () => {
  // Init engine and RPCs
  dbg('Initializing Engine and RPCs...');
  startEngine();
  setOnUTXOMerkletreeScanCallback(onUTXOMerkletreeScanCallback);
  setOnTXIDMerkletreeScanCallback(onTXIDMerkletreeScanCallback);

  await initNetworkProviders();

  // Make sure TXID trees are fully scanned for each chain.
  for (const networkName of Config.NETWORK_NAMES) {
    const chain = chainForNetwork(networkName);
    for (const txidVersion of Config.TXID_VERSIONS) {
  
      //CLEAR_TXID WEIRD BLOCK HERE.
      if (process.env.CLEAR_TXIDS === '1') {
        // Can safely remove this after TXID verificationHash is implemented.
        dbg(`Clearing TXIDs for ${networkName}, ${txidVersion}...`);
          await RailgunTxidMerkletreeManager.clearValidatedStatus(
            networkName,
            txidVersion,
          );
          const txidMerkletree = getTXIDMerkletreeForNetwork(
            txidVersion,
            networkName,
          );
          await txidMerkletree.clearDataForMerkletree();
      }
      await getEngine().syncRailgunTransactionsForTXIDVersion(
        txidVersion,
        chain,
        'initEngineAndScanTXIDs',
      );
  
      // Ensures that validated txid index is correct after TXID scan.
      await RailgunTxidMerkletreeManager.checkValidatedTxidIndexAgainstEngine(
        networkName,
        txidVersion,
      );
    }
  }

};

export const initModules = async (listKeys: string[]) => {
  dbg('Generating POI Merkletrees for each list and network...');
  POIMerkletreeManager.initListMerkletrees(listKeys);

  dbg('Inflating Transact Proof mempool cache...');
  await TransactProofMempool.inflateCacheFromDatabase(listKeys);

  dbg('Inflating Legacy Transact Proof mempool cache...');
  await LegacyTransactProofMempool.inflateCacheFromDatabase();

  dbg('Inflating Blocked Shields cache...');
  await BlockedShieldsSyncer.inflateCacheFromDatabase(listKeys);

  dbg('Node init successful.');
};
