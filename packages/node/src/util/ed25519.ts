import { getPublicKey, sign, verify } from '@noble/ed25519';
import { SnarkProof, isDefined } from '@railgun-community/shared-models';
import { bytesToHex, hexStringToBytes } from '@railgun-community/wallet';
import {
  POIEventShield,
  POIEventTransact,
  SignedPOIEvent,
} from '../models/poi-types';
import { utf8ToBytes } from '@noble/hashes/utils';

const getPKey = (): Uint8Array => {
  const pkey = process.env.pkey;
  if (!isDefined(pkey)) {
    throw new Error(
      'You must configure ed25519 pkey in .env file. Copy settings from .env.example to start.',
    );
  }
  return hexStringToBytes(pkey);
};

export const signMessage = async (message: Uint8Array): Promise<string> => {
  const pkey = getPKey();
  const signatureUint8Array = await sign(message, pkey);
  return bytesToHex(signatureUint8Array);
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

export const getListPublicKey = async (): Promise<string> => {
  const pkey = getPKey();
  const publicKey = await getPublicKey(pkey);
  return bytesToHex(publicKey);
};
