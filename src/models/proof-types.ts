export type ShieldProofData = {
  snarkProof: SnarkProof;
  commitmentHash: string;
  blindedCommitment: string;
};

export type TransactProofData = {
  snarkProof: SnarkProof;
  poiMerkleroots: string[];
  txMerkleroot: string;
  txidIndex: number;
  blindedCommitmentInputs: string[];
  blindedCommitmentOutputs: string[];
};

export type SnarkProof = {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
};
