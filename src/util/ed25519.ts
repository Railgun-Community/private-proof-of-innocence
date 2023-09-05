import { getPublicKey, sign, verify } from '@noble/ed25519';
import { utf8ToBytes } from '@noble/hashes/utils';
import { isDefined } from '@railgun-community/shared-models';
import { bytesToHex, hexStringToBytes } from '@railgun-community/wallet';
import { POIEvent, SignedPOIEvent } from '../models/poi-types';

const getPKey = (): Uint8Array => {
  const pkey = process.env.pkey;
  if (!isDefined(pkey)) {
    throw new Error('Set env pkey');
  }
  return hexStringToBytes(pkey);
};

const getPOIEventMessage = (poiEvent: POIEvent) => {
  return utf8ToBytes(
    JSON.stringify({
      index: poiEvent.index,
      blindedCommitments: poiEvent.blindedCommitments,
      proof: poiEvent.proof,
    }),
  );
};

export const signPOIEvent = async (poiEvent: POIEvent): Promise<string> => {
  const pkey = getPKey();
  const message = getPOIEventMessage(poiEvent);
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
