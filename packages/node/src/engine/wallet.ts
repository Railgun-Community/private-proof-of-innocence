import {
  NETWORK_CONFIG,
  NetworkName,
  TXIDVersion,
} from '@railgun-community/shared-models';
import {
  ShieldData,
  validateRailgunTxidOccurredBeforeBlockNumber,
  getGlobalUTXOTreePositionForRailgunTransactionCommitment,
  getShieldsForTXIDVersion,
} from '@railgun-community/wallet';
import debug from 'debug';

const dbg = debug('poi:wallet');

export const getNewShieldsFromWallet = (
  networkName: NetworkName,
  txidVersion: TXIDVersion,
  startingBlock: number,
): Promise<ShieldData[]> => {
  const { supportsV3 } = NETWORK_CONFIG[networkName];
  if (!supportsV3 && txidVersion === TXIDVersion.V3_PoseidonMerkle) {
    dbg(`${networkName} does not support V3 txids.`);
    return Promise.resolve([]);
  }

  return getShieldsForTXIDVersion(txidVersion, networkName, startingBlock);
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
