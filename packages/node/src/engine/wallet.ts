import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  ShieldData,
  getAllShields,
  validateRailgunTxidOccurredBeforeBlockNumber,
  getGlobalUTXOTreePositionForRailgunTransactionCommitment,
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

export const tryGetGlobalUTXOTreePositionForRailgunTransactionCommitment =
  async (
    txidVersion: TXIDVersion,
    networkName: NetworkName,
    tree: number,
    index: number,
    commitmentHash: string,
  ): Promise<number> => {
    try {
      return await getGlobalUTXOTreePositionForRailgunTransactionCommitment(
        txidVersion,
        networkName,
        tree,
        index,
        commitmentHash,
      );
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Could not get global utxo tree position for commitment - ${err.message}`,
      );
      throw err;
    }
  };
