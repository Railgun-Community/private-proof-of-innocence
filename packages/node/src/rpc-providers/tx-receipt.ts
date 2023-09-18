import { NetworkName, isDefined } from '@railgun-community/shared-models';
import { TransactionReceipt } from 'ethers';
import { getProviderForNetwork } from './active-network-providers';

export const getTransactionReceipt = async (
  networkName: NetworkName,
  txid: string,
): Promise<TransactionReceipt> => {
  const provider = getProviderForNetwork(networkName);
  const txReceipt = await provider.getTransactionReceipt(txid);
  if (!isDefined(txReceipt)) {
    throw new Error(`Transaction receipt not found for ${txid}`);
  }
  return txReceipt;
};

export const getTimestampFromTransactionReceipt = async (
  networkName: NetworkName,
  txReceipt: TransactionReceipt,
): Promise<number> => {
  const provider = getProviderForNetwork(networkName);
  const block = await provider.getBlock(txReceipt.blockNumber);
  if (!isDefined(block)) {
    throw new Error(`Block data not found for ${txReceipt.blockNumber}`);
  }
  const timestamp = block.timestamp;
  return timestamp;
};
