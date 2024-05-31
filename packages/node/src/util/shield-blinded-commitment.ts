import {
  BlindedCommitment,
  ByteUtils,
  ShieldData,
} from '@railgun-community/wallet';

// 2^16
const MAX_ITEMS = 65_536;

const getGlobalTreePosition = (utxoTree: number, utxoIndex: number) => {
  return utxoTree * MAX_ITEMS + utxoIndex;
};

export const calculateShieldBlindedCommitment = (
  shieldData: ShieldData,
): string => {
  return BlindedCommitment.getForShieldOrTransact(
    shieldData.commitmentHash,
    ByteUtils.hexToBigInt(shieldData.npk),
    BigInt(getGlobalTreePosition(shieldData.utxoTree, shieldData.utxoIndex)),
  );
};
