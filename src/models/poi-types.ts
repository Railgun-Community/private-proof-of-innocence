import { SnarkProof } from './proof-types';

export type POIEvent = {
  index: number;
  blindedCommitmentStartingIndex: number;
  blindedCommitments: string[];
  proof: SnarkProof;
};

export type SignedPOIEvent = POIEvent & {
  signature: string;
};
