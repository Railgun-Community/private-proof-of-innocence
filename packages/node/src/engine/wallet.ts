import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  ShieldData,
  getAllShields,
  validateRailgunTxidOccurredBeforeBlockNumber,
} from '@railgun-community/wallet';
import debug from 'debug';

const dbg = debug('poi:wallet');

export const getNewShieldsFromWallet = (
  networkName: NetworkName,
  startingBlock: number,
): Promise<ShieldData[]> => {
  return getAllShields(networkName, startingBlock);
};

export const tryValidateRailgunTxidOccurredBeforeBlockNumber = async (
  txidVersion: TXIDVersion,
  networkName: NetworkName,
  tree: number,
  index: number,
  launchBlock: number,
): Promise<boolean> => {
  try {
    return await validateRailgunTxidOccurredBeforeBlockNumber(
      txidVersion,
      networkName,
      tree,
      index,
      launchBlock,
    );
  } catch (err) {
    dbg(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Could not validated txid occurred before blockNumber - ${err.message}`,
    );
    return false;
  }
};
