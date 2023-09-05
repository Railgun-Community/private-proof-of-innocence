import { SerializedSnarkProof } from './general-types';

export type POIEvent = {
  index: number;
  blindedCommitments: string[];
  proof: SerializedSnarkProof;
};

export type SignedPOIEvent = POIEvent & {
  signature: string;
};
