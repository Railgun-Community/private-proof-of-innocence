import { POIEventType, SnarkProof } from '@railgun-community/shared-models';
import { SortDirection } from 'mongodb';
import { Readable } from 'stream';

export type DBMaxMin<T> = Partial<T>;

export type DBFilter<T> = Partial<T>;

export type DBSort<T> = Partial<Record<keyof T, SortDirection>>;

export type DBIndexSpec<T> = (keyof T)[];

export type DBOptional<T> = Optional<T> | null;

export type DBStream<T> = Readable & AsyncIterable<T>;

export enum CollectionName {
  // General
  Status = 'Status',
  RailgunTxidMerkletreeStatus = 'RailgunTxidMerkletreeStatus',

  // Pending shields
  ShieldQueue = 'ShieldQueue',

  // Proof mempools
  TransactProofPerListMempool = 'TransactProofPerListMempool',
  LegacyTransactProofMempool = 'LegacyTransactProofMempool',

  // POI databases
  POIOrderedEvents = 'POIOrderedEvents',
  POIMerkletree = 'POIMerkletree',
  POIHistoricalMerkleroots = 'POIHistoricalMerkleroots',

  // Blocked shields
  BlockedShieldsPerList = 'BlockedShieldsPerList',

  // Test
  Test = 'Test',
}

export enum ShieldStatus {
  // Waiting for validation
  Unknown = 'Unknown',

  // Waiting for validation
  Pending = 'Pending',

  // Validation statuses
  Allowed = 'Allowed',
  Blocked = 'Blocked',

  // POI status
  AddedPOI = 'AddedPOI',
}

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type ShieldQueueDBItem = {
  txid: string;
  commitmentHash: string;
  blindedCommitment: string;
  npk: string;
  timestamp: number;
  status: ShieldStatus;
  lastValidatedTimestamp: DBOptional<number>;
  blockNumber: number;
  utxoTree: number;
  utxoIndex: number;
};

export type StatusDBItem = {
  latestBlockScanned: number;
};

export type RailgunTxidMerkletreeStatusDBItem = {
  validatedTxidIndex: number;
  validatedTxidMerkleroot: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type ShieldProofMempoolDBItem = {
  snarkProof: SnarkProof;
  commitmentHash: string;
  blindedCommitment: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type TransactProofMempoolDBItem = {
  listKey: string;
  snarkProof: SnarkProof;
  poiMerkleroots: string[];
  txidMerkleroot: string;
  txidMerklerootIndex: number;
  blindedCommitmentsOut: string[];
  railgunTxidIfHasUnshield: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type LegacyTransactProofMempoolDBItem = {
  txidIndex: string;
  npk: string;
  value: string;
  tokenHash: string;
  blindedCommitment: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIOrderedEventDBItem = {
  listKey: string;
  index: number;
  blindedCommitment: string;
  signature: string;
  type: POIEventType;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIMerkletreeDBItem = {
  listKey: string;
  tree: number;
  level: number;
  index: number;
  nodeHash: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIHistoricalMerklerootDBItem = {
  listKey: string;
  rootHash: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type BlockedShieldsPerListDBItem = {
  listKey: string;
  commitmentHash: string;
  blindedCommitment: string;
  blockReason: DBOptional<string>;
  signature: string;
};

export type TestDBItem = {
  test: string;
};
