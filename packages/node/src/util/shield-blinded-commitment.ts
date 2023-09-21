import { ByteLength, ShieldData, nToHex } from '@railgun-community/wallet';
import { poseidon } from 'circomlibjs';

export const calculateShieldBlindedCommitment = (
  shieldData: ShieldData,
): string => {
  const hash = poseidon(
    [
      shieldData.commitmentHash,
      shieldData.npk,
      shieldData.utxoTree,
      shieldData.utxoIndex,
    ].map(x => BigInt(x)),
  );
  return `0x${nToHex(hash, ByteLength.UINT_256)}`;
};
