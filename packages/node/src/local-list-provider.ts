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
    name: 'Chainalysis OFAC Sanctions List',
    description: `Blocks OFAC-sanctioned addresses.`,
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
    const isSanctioned = await this.isSanctionedAddress(fromAddressLowercase);
    if (isSanctioned) {
      return {
        shouldAllow: false,
        blockReason: 'Address is sanctioned',
      };
    }

    if (TEST_BAD_ADDRESS_LIST.includes(fromAddressLowercase)) {
      return { shouldAllow: false, blockReason: 'Test address is blocked' };
    }

    return { shouldAllow: true };
  }

  private isSanctionedAddress = async (address: string): Promise<boolean> => {
    try {
      const apiKey = process.env.CHAINALYSIS_API_KEY;
      if (!isDefined(apiKey)) {
        throw new Error('No API Key for Chainalysis OFAC API');
      }

      const url = `https://public.chainalysis.com/api/v1/address/${address}`;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data } = await axios.get(url, {
        headers: { 'X-API-KEY': apiKey },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const identifications = data.identifications as {
        category: string;
        source: string;
      }[];

      const isSanctioned =
        isDefined(identifications) &&
        identifications.some(id => id.category === 'sanctions');

      return isSanctioned;
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      throw new Error(`Could not screen address: ${err.message}.`);
    }
  };
}
