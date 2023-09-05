/* eslint-disable @typescript-eslint/no-unused-vars */

import { NetworkName } from '@railgun-community/shared-models';
import {
  ListProvider,
  ListProviderConfig,
} from '../../list-provider/list-provider';

export class TestMockListProviderNoAAddress extends ListProvider {
  protected config: ListProviderConfig = {
    name: 'MOCK List Provider',
    description: `Excludes a single address.`,
  };

  protected async shouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ): Promise<boolean> {
    if (fromAddressLowercase.startsWith('0xa')) {
      return false;
    }
    return true;
  }
}
