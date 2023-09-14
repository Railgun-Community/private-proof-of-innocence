import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData, TransactProofData } from './proof-types';

export type POIEventListStatus = {
  length: number;
};

export type GetShieldProofsParams = {
  bloomFilterSerialized: string;
};

export type GetTransactProofsParams = {
  bloomFilterSerialized: string;
};

export type SubmitShieldProofParams = {
  shieldProofData: ShieldProofData;
};

export type SubmitTransactProofParams = {
  listKey: string;
  transactProofData: TransactProofData;
};

export type GetPOIsPerListParams = {
  listKeys: string[];
  blindedCommitments: string[];
};

export type GetMerkleProofsParams = {
  listKey: string;
  blindedCommitments: string[];
};

export type ValidateTxidMerklerootParams = {
  tree: number;
  index: number;
  merkleroot: string;
};

export type POIExistenceListMap = {
  [listKey: string]: boolean[];
};

export type TxidMerkletreeSyncStatus = {
  currentTxidIndex: number;
  currentMerkleroot: string;
  validatedTxidIndex: number;
  validatedMerkleroot: string;
};

export type RailgunTxidStatus = {
  currentTxidIndex: Optional<number>;
  currentMerkleroot: Optional<string>;
  validatedTxidIndex: Optional<number>;
  validatedMerkleroot: Optional<string>;
};

export type ValidatedRailgunTxidStatus = {
  validatedTxidIndex: Optional<number>;
  validatedMerkleroot: Optional<string>;
};

export type NodeStatusAllNetworks = {
  listKeys: string[];
  forNetwork: Partial<Record<NetworkName, NodeStatusForNetwork>>;
};

export type NodeStatusForNetwork = {
  txidStatus: RailgunTxidStatus;
  eventListStatuses: Record<string, POIEventListStatus>;
};
