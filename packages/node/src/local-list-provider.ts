/* eslint-disable @typescript-eslint/no-unused-vars */

import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  ListProvider,
  ListProviderConfig,
} from './list-provider/list-provider';
import { ethers } from 'ethers';
import axios from 'axios';

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

    return { shouldAllow: true };
  }

  private async checkSanctionsWithContract(address: string): Promise<boolean> {
    // Provider
    const rpcUrl = process.env.CHAINALYSIS_API_BACKUP_RPC;
    if (!isDefined(rpcUrl)) {
      throw new Error('No RPC URL for Chainalysis Oracle Backup');
    }

    // Initialize a provider (e.g., Infura, Alchemy, or an ethers default provider)
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Smart Contract (isSanctioned and isSanctionedVerbose)
    const chainalysisAbi = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'addr',
            type: 'address',
          },
        ],
        name: 'isSanctioned',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'addr',
            type: 'address',
          },
        ],
        name: 'isSanctionedVerbose',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ];
    const chainalysisContractAddress =
      '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';
    const chainalysisContract = new ethers.Contract(
      chainalysisContractAddress,
      chainalysisAbi,
      provider,
    );

    try {
      const isSanctioned = (await chainalysisContract.isSanctioned(
        address,
      )) as boolean;
      return isSanctioned;
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }

      throw new Error(`Could not screen address: ${err.message}.`);
    }
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
        identifications.some(
          id =>
            id.category.toLowerCase() === 'sanctions' ||
            id.category.toLowerCase() === 'sanctioned entity',
        );

      return isSanctioned;
    } catch (err) {
      // If the primary API check fails, use the smart contract as a backup
      return this.checkSanctionsWithContract(address);
    }
  };
}
