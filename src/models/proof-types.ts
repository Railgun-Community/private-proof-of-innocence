export type ShieldProofPublicInputs = {
  commitmentHash: string;
  blindedCommitment: string;
};

export type ShieldProofData = {
  snarkProof: SnarkProof;
  publicInputs: ShieldProofPublicInputs;
};

export type TransactProofPublicInputs = {
  poiMerkleroots: string[];
  txMerkleroot: string;
  blindedCommitmentInputs: string[];
  blindedCommitmentOutputs: string[];
};

export type TransactProofData = {
  snarkProof: SnarkProof;
  publicInputs: TransactProofPublicInputs;
};

export type SnarkProof = {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
};
