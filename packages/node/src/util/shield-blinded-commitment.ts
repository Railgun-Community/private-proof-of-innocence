import {
  ShieldData,
  getBlindedCommitmentForShieldOrTransact,
  hexToBigInt,
} from '@railgun-community/wallet';

// 2^16
const MAX_ITEMS = 65_536;

const getGlobalTreePosition = (utxoTree: number, utxoIndex: number) => {
  return utxoTree * MAX_ITEMS + utxoIndex;
};

export const calculateShieldBlindedCommitment = (
  shieldData: ShieldData,
): string => {
  return getBlindedCommitmentForShieldOrTransact(
    shieldData.commitmentHash,
    hexToBigInt(shieldData.npk),
    BigInt(getGlobalTreePosition(shieldData.utxoTree, shieldData.utxoIndex)),
  );
};
