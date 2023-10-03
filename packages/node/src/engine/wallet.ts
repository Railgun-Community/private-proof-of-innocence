import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  ShieldData,
  getAllShields,
  validateRailgunTxidOccurredBeforeBlockNumber,
} from '@railgun-community/wallet';

export const getNewShieldsFromWallet = (
  networkName: NetworkName,
  startingBlock: number,
): Promise<ShieldData[]> => {
  return getAllShields(networkName, startingBlock);
};

export const tryValidateRailgunTxidOccurredBeforeBlockNumber = (
  txidVersion: TXIDVersion,
  networkName: NetworkName,
  tree: number,
  index: number,
  launchBlock: number,
) => {
  return validateRailgunTxidOccurredBeforeBlockNumber(
    txidVersion,
    networkName,
    tree,
    index,
    launchBlock,
  );
};
