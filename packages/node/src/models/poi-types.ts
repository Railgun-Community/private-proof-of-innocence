import {
  BlindedCommitmentData,
  POIEventType,
  POIStatus,
  TXIDVersion,
} from '@railgun-community/shared-models';

export type POIEventShield = {
  type: POIEventType.Shield;
  blindedCommitment: string;
  commitmentHash: string;
};

export type POIEventTransact = {
  type: POIEventType.Transact;
  blindedCommitment: string;
};

export type POIEventUnshield = {
  type: POIEventType.Unshield;
  blindedCommitment: string;
};

export type POIEventLegacyTransact = {
  type: POIEventType.LegacyTransact;
  blindedCommitment: string;
};

export type POIEvent =
  | POIEventShield
  | POIEventTransact
  | POIEventUnshield
  | POIEventLegacyTransact;

export type SignedPOIEvent = {
  index: number;
  blindedCommitment: string;
  signature: string;
  type: POIEventType;
};

export type SignedBlockedShield = {
  commitmentHash: string;
  blindedCommitment: string;
  blockReason: Optional<string>;
  signature: string;
};

export type SubmitPOIEventParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  signedPOIEvent: SignedPOIEvent;
  listKey: string;
  validatedMerkleroot: string;
};

export type SubmitValidatedTxidAndMerklerootParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  txidIndex: number;
  merkleroot: string;
  signature: string;
  listKey: string;
};

export type RemoveTransactProofParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  blindedCommitmentsOut: string[];
  railgunTxidIfHasUnshield: string;
  signature: string;
  listKey: string;
};

export type GetLegacyTransactProofsParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  bloomFilterSerialized: string;
};

export type GetPOIListEventRangeParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  listKey: string;
  startIndex: number;
  endIndex: number;
};

export type GetPOIMerkletreeLeavesParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  listKey: string;
  startIndex: number;
  endIndex: number;
};

export type POISyncedListEvent = {
  signedPOIEvent: SignedPOIEvent;
  validatedMerkleroot: string;
};

export type GetPOIsPerBlindedCommitmentParams = {
  chainType: string;
  chainID: string;
  txidVersion: TXIDVersion;
  listKey: string;
  blindedCommitmentDatas: BlindedCommitmentData[];
};

export type POIsPerBlindedCommitmentMap = {
  [blindedCommitment: string]: POIStatus;
};
