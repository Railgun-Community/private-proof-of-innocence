// TestableListProvider.ts (in the test folder)

import { LocalListProvider } from '../../local-list-provider';
import { NetworkName } from '@railgun-community/shared-models';

export class TestableListProvider extends LocalListProvider {
  constructor(listKey: string) {
    super(listKey);
  }

  public async testShouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ) {
    return this.shouldAllowShield(
      networkName,
      txid,
      fromAddressLowercase,
      timestamp,
    );
  }
}
