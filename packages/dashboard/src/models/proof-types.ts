// TODO: This file is a copy of packages/node/src/api/proof-types.ts it should be moved to a shared location

export type ShieldProofData = {
  snarkProof: SnarkProof;
  commitmentHash: string;
  blindedCommitment: string;
};

export type TransactProofData = {
  snarkProof: SnarkProof;
  poiMerkleroots: string[];
  txidMerkleroot: string;
  txidMerklerootIndex: number;
  blindedCommitmentOutputs: string[];
};

export type SnarkProof = {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
};

export type MerkleProof = {
  leaf: string; // hash of commitment
  elements: string[];
  indices: string;
  root: string;
};
