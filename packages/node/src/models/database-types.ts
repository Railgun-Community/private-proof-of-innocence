import { SortDirection } from 'mongodb';
import { SnarkProof } from './proof-types';
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
  ShieldProofMempool = 'ShieldProofMempool',
  TransactProofPerListMempool = 'TransactProofPerListMempool',

  // POI databases
  POIOrderedEvents = 'POIOrderedEvents',
  POIMerkletree = 'POIMerkletree',
  POIHistoricalMerkleroots = 'POIHistoricalMerkleroots',

  // Test
  Test = 'Test',
}

export enum ShieldStatus {
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
  hash: string;
  timestamp: number;
  status: ShieldStatus;
  lastValidatedTimestamp: DBOptional<number>;
  blockNumber: number;
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
  blindedCommitmentOutputs: string[];
  firstBlindedCommitment: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIOrderedEventDBItem = {
  listKey: string;
  index: number;
  blindedCommitmentStartingIndex: number;
  blindedCommitments: string[];
  firstBlindedCommitment: string;
  proof: SnarkProof;
  signature: string;
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

export type TestDBItem = {
  test: string;
};
