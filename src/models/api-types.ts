import { ShieldProofData, TransactProofData } from './proof-types';

export type POIEventListStatus = {
  length: number;
};

export type GetShieldProofsParams = {
  bloomFilterSerialized: string;
};

export type GetTransactProofsParams = {
  listKey: string;
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
  blindedCommitment: string;
};

export type GetMerkleProofsParams = {
  listKeys: string[];
  blindedCommitments: string[];
};
