import { getPublicKey, sign, verify } from '@noble/ed25519';
import { utf8ToBytes } from '@noble/hashes/utils';
import { isDefined } from '@railgun-community/shared-models';
import { bytesToHex, hexStringToBytes } from '@railgun-community/wallet';
import { SignedPOIEvent, UnsignedPOIEvent } from '../models/poi-types';

const getPKey = (): Uint8Array => {
  const pkey = process.env.pkey;
  if (!isDefined(pkey)) {
    throw new Error(
      'You must configure ed25519 pkey in .env file. Copy settings from .env.example to start.',
    );
  }
  return hexStringToBytes(pkey);
};

const getPOIEventMessage = (unsignedPOIEvent: UnsignedPOIEvent) => {
  return utf8ToBytes(
    JSON.stringify({
      index: unsignedPOIEvent.index,
      blindedCommitmentStartingIndex:
        unsignedPOIEvent.blindedCommitmentStartingIndex,
      blindedCommitments: unsignedPOIEvent.blindedCommitments,
      proof: unsignedPOIEvent.proof,
    }),
  );
};

export const signPOIEvent = async (
  unsignedPOIEvent: UnsignedPOIEvent,
): Promise<string> => {
  const pkey = getPKey();
  const message = getPOIEventMessage(unsignedPOIEvent);
  const signatureUint8Array = await sign(message, pkey);
  return bytesToHex(signatureUint8Array);
};

export const verifyPOIEvent = async (
  signedPOIEvent: SignedPOIEvent,
  publicKey: string,
): Promise<boolean> => {
  try {
    const message = getPOIEventMessage(signedPOIEvent);
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
