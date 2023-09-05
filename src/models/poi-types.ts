import { SerializedSnarkProof } from './general-types';

export type POIEvent = {
  blindedCommitments: string[];
  proof: SerializedSnarkProof;
  signature: string[];
};
