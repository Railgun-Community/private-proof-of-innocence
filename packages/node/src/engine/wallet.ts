import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { ShieldData, getAllShields } from '@railgun-community/wallet';

export const getNewShieldsFromWallet = (
  networkName: NetworkName,
  startingBlock: number,
): Promise<ShieldData[]> => {
  return getAllShields(networkName, startingBlock);
};
