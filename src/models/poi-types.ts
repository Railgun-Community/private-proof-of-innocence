import { SerializedSnarkProof } from './general-types';

export type POIEvent = {
  index: number;
  blindedCommitments: string[];
  proof: SerializedSnarkProof;
  signature: string[];
};
