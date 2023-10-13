import { ByteLength, ShieldData, nToHex } from '@railgun-community/wallet';
import { poseidon } from 'circomlibjs';

const TREE_DEPTH = 16;
const bitwiseMerge = (tree: number, index: number) => {
  return (tree << TREE_DEPTH) + index;
};

export const calculateShieldBlindedCommitment = (
  shieldData: ShieldData,
): string => {
  const hash = poseidon(
    [
      shieldData.commitmentHash,
      shieldData.npk,
      bitwiseMerge(shieldData.utxoTree, shieldData.utxoIndex),
    ].map(x => BigInt(x)),
  );
  return `0x${nToHex(hash, ByteLength.UINT_256)}`;
};
