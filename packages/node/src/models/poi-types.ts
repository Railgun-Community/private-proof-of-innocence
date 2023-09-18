import { SnarkProof } from '@railgun-community/shared-models';

export enum POIEventType {
  Shield = 'Shield',
  Transact = 'Transact',
}

type POIEventShared = {
  blindedCommitments: string[];
  proof: SnarkProof;
};

export type POIEventShield = POIEventShared & {
  type: POIEventType.Shield;
  commitmentHash: string;
};

export type POIEventTransact = POIEventShared & {
  type: POIEventType.Transact;
  firstBlindedCommitment: string;
};

export type POIEvent = POIEventShield | POIEventTransact;

export type UnsignedPOIEvent = {
  index: number;
  blindedCommitmentStartingIndex: number;
  blindedCommitments: string[];
  proof: SnarkProof;
};

export type SignedPOIEvent = UnsignedPOIEvent & {
  index: number;
  blindedCommitmentStartingIndex: number;
  blindedCommitments: string[];
  proof: SnarkProof;
  signature: string;
};
