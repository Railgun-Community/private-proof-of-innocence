import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { hexToBigInt } from '@railgun-community/wallet';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import debug from 'debug';

const dbg = debug('poi:transact-proof-mempool');

export class TransactProofEventMatcher {
  static async hasOrderedEventForEveryBlindedCommitment(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitments: string[],
    railgunTxidIfHasUnshield: string,
  ): Promise<boolean> {
    const blindedCommitmentsIncludingUnshield = blindedCommitments.filter(
      blindedCommitment => {
        return hexToBigInt(blindedCommitment) !== 0n;
      },
    );
    if (hexToBigInt(railgunTxidIfHasUnshield) !== 0n) {
      blindedCommitmentsIncludingUnshield.push(railgunTxidIfHasUnshield);
    }

    const orderedEventsDB = new POIOrderedEventsDatabase(
      networkName,
      txidVersion,
    );

    const existingEvents: string[] = [];

    for (const blindedCommitment of blindedCommitmentsIncludingUnshield) {
      const orderedEventExists = await orderedEventsDB.eventExists(
        listKey,
        blindedCommitment,
      );
      if (orderedEventExists) {
        existingEvents.push(blindedCommitment);
      }
    }

    if (
      existingEvents.length > 0 &&
      existingEvents.length < blindedCommitmentsIncludingUnshield.length
    ) {
      dbg(
        `DANGER: some transact events (${
          existingEvents.length
        }) already exist for ${existingEvents.join(
          ', ',
        )}, but not for all blinded commitments (${
          blindedCommitmentsIncludingUnshield.length
        }): ${blindedCommitmentsIncludingUnshield.join(', ')}`,
      );
    }

    return existingEvents.length === blindedCommitmentsIncludingUnshield.length;
  }
}
