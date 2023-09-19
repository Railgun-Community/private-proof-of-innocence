import { SnarkProof } from '@railgun-community/shared-models';

export enum POIEventType {
  Shield = 'Shield',
  Transact = 'Transact',
}

export type POIEventShield = {
  type: POIEventType.Shield;
  blindedCommitment: string;
  commitmentHash: string;
};

export type POIEventTransact = {
  type: POIEventType.Transact;
  blindedCommitments: string[];
  proof: SnarkProof;
};

export type POIEvent = POIEventShield | POIEventTransact;

export type SignedPOIEvent = {
  index: number;
  blindedCommitmentStartingIndex: number;
  blindedCommitments: string[];
  signature: string;

  // Only for Transact events
  proof: Optional<SnarkProof>;
};
