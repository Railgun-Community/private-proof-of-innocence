/* eslint-disable @typescript-eslint/no-unused-vars */

import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  ListProvider,
  ListProviderConfig,
} from './list-provider/list-provider';
import axios from 'axios';

const TEST_BAD_ADDRESS_LIST = [
  '0xD017c45b95BbD074AB9Ce0FC95086a59957C4bEd',
  '0x6FcfE6a9c8f4906FAaD183f5eFdfECe9e7987479',
  '0xC5271A4077962BEEd9035961b38cdcdEfFFce1a5',
].map(a => a.toLowerCase());

export class LocalListProvider extends ListProvider {
  protected config: ListProviderConfig = {
    name: 'Test List',
    description: `Blocks test addresses.`,
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
    if (TEST_BAD_ADDRESS_LIST.includes(fromAddressLowercase)) {
      return { shouldAllow: false, blockReason: 'Test address is blocked' };
    }

    return { shouldAllow: true };
  }
}
