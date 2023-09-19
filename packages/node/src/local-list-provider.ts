/* eslint-disable @typescript-eslint/no-unused-vars */

import { NetworkName } from '@railgun-community/shared-models';
import {
  ListProvider,
  ListProviderConfig,
} from './list-provider/list-provider';

export class LocalListProvider extends ListProvider {
  protected config: ListProviderConfig = {
    name: 'Local List Provider',
    description: `Run against this List Provider with 'yarn start'`,
  };

  protected async shouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ): Promise<
    | { shouldAllow: true }
    | { shouldAllow: false; blockReason: Optional<string> }
  > {
    //
    // Add custom logic to block certain addresses or transactions.
    // If excluding, return false.
    //
    // For example:
    //
    // if (BAD_ADDRESS_LIST.includes(fromAddressLowercase)) {
    //   return { shouldAllow: false, blockReason: 'Bad address' };
    // }
    //

    return { shouldAllow: true };
  }
}
