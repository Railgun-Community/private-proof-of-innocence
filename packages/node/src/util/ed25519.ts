import { getPublicKey, sign, verify } from '@noble/ed25519';
import { SnarkProof, isDefined } from '@railgun-community/shared-models';
import { bytesToHex, hexStringToBytes } from '@railgun-community/wallet';
import {
  POIEventLegacyTransact,
  POIEventShield,
  POIEventTransact,
  SignedBlockedShield,
  SignedPOIEvent,
} from '../models/poi-types';
import { utf8ToBytes } from '@noble/hashes/utils';

const getPKey = (): Uint8Array => {
  const pkey = process.env.pkey;
  if (!isDefined(pkey)) {
    throw new Error('You must configure ed25519 "pkey" variable in .env file.');
  }
  return hexStringToBytes(pkey);
};

export const signMessage = async (message: Uint8Array): Promise<string> => {
  const pkey = getPKey();
  const signatureUint8Array = await sign(message, pkey);
  return bytesToHex(signatureUint8Array);
};

export const signPOIEventShield = async (
  index: number,
  blindedCommitmentStartingIndex: number,
  poiEventShield: POIEventShield,
): Promise<string> => {
  const message = getPOIEventMessage(index, blindedCommitmentStartingIndex, [
    poiEventShield.blindedCommitment,
  ]);
  return signMessage(message);
};

export const signPOIEventTransact = async (
  index: number,
  blindedCommitmentStartingIndex: number,
  poiEventTransact: POIEventTransact,
): Promise<string> => {
  const message = getPOIEventMessage(
    index,
    blindedCommitmentStartingIndex,
    poiEventTransact.blindedCommitments,
    poiEventTransact.proof,
  );
  return signMessage(message);
};

export const signPOIEventLegacyTransact = async (
  index: number,
  blindedCommitmentStartingIndex: number,
  poiEventTransact: POIEventLegacyTransact,
): Promise<string> => {
  const message = getPOIEventMessage(index, blindedCommitmentStartingIndex, [
    poiEventTransact.blindedCommitment,
  ]);
  return signMessage(message);
};

const getPOIEventMessage = (
  index: number,
  blindedCommitmentStartingIndex: number,
  blindedCommitments: string[],
  proof?: SnarkProof,
): Uint8Array => {
  const data = {
    index,
    blindedCommitmentStartingIndex,
    blindedCommitments,
  };
  if (proof) {
    // @ts-expect-error
    data.proof = proof;
  }
  return utf8ToBytes(JSON.stringify(data));
};

export const verifyPOIEvent = async (
  signedPOIEvent: SignedPOIEvent,
  publicKey: string,
): Promise<boolean> => {
  try {
    const message = getPOIEventMessage(
      signedPOIEvent.index,
      signedPOIEvent.blindedCommitmentStartingIndex,
      signedPOIEvent.blindedCommitments,
      signedPOIEvent.proof,
    );
    return await verify(signedPOIEvent.signature, message, publicKey);
  } catch (err) {
    return false;
  }
};

export const signBlockedShield = async (
  commitmentHash: string,
  blindedCommitment: string,
  blockReason?: string,
): Promise<string> => {
  const message = getBlockedShieldMessage(
    commitmentHash,
    blindedCommitment,
    blockReason,
  );
  return signMessage(message);
};

export const signRemoveProof = async (
  firstBlindedCommitment: string,
): Promise<string> => {
  const message = getRemoveProofMessage(firstBlindedCommitment);
  return signMessage(message);
};

const getBlockedShieldMessage = (
  commitmentHash: string,
  blindedCommitment: string,
  blockReason?: string,
): Uint8Array => {
  const data = {
    commitmentHash,
    blindedCommitment,
  };
  if (isDefined(blockReason)) {
    // @ts-expect-error
    data.blockReason = blockReason;
  }
  return utf8ToBytes(JSON.stringify(data));
};

const getRemoveProofMessage = (firstBlindedCommitment: string): Uint8Array => {
  const data = {
    firstBlindedCommitment,
  };
  return utf8ToBytes(JSON.stringify(data));
};

export const verifyBlockedShield = async (
  blockedShield: SignedBlockedShield,
  publicKey: string,
): Promise<boolean> => {
  try {
    const message = getBlockedShieldMessage(
      blockedShield.commitmentHash,
      blockedShield.blindedCommitment,
      blockedShield.blockReason,
    );
    return await verify(blockedShield.signature, message, publicKey);
  } catch (err) {
    return false;
  }
};

export const verifyRemoveProof = async (
  firstBlindedCommitment: string,
  publicKey: string,
  signature: string,
): Promise<boolean> => {
  try {
    const message = getRemoveProofMessage(firstBlindedCommitment);
    return await verify(signature, message, publicKey);
  } catch (err) {
    return false;
  }
};

export const signValidatedTxidMerkleroot = async (
  txidIndex: number,
  merkleroot: string,
): Promise<string> => {
  const message = getValidatedTxidMerklerootMessage(txidIndex, merkleroot);
  return signMessage(message);
};

const getValidatedTxidMerklerootMessage = (
  txidIndex: number,
  merkleroot: string,
): Uint8Array => {
  const data = {
    txidIndex,
    merkleroot,
  };
  return utf8ToBytes(JSON.stringify(data));
};

export const verifyTxidMerkleroot = async (
  txidIndex: number,
  merkleroot: string,
  signature: string,
  publicKey: string,
): Promise<boolean> => {
  try {
    const message = getValidatedTxidMerklerootMessage(txidIndex, merkleroot);
    return await verify(signature, message, publicKey);
  } catch (err) {
    return false;
  }
};

export const getListPublicKey = async (): Promise<string> => {
  const pkey = getPKey();
  const publicKey = await getPublicKey(pkey);
  return bytesToHex(publicKey);
};
