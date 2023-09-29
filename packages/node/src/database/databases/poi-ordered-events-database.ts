import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBMaxMin,
  DBSort,
  POIOrderedEventDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { SignedPOIEvent } from '../../models/poi-types';

export class POIOrderedEventsDatabase extends AbstractDatabase<POIOrderedEventDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.POIOrderedEvents);
  }

  async createCollectionIndices() {
    await this.createIndex(['index', 'listKey'], { unique: true });
    await this.createIndex(['index']);
    await this.createIndex(['listKey']);
    await this.createIndex(['firstBlindedCommitment']);
  }

  async insertValidSignedPOIEvent(
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ): Promise<void> {
    const {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments,
      proof,
      signature,
    } = signedPOIEvent;
    const item: POIOrderedEventDBItem = {
      listKey,
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments,
      firstBlindedCommitment: blindedCommitments[0],
      proof,
      signature,
    };
    await this.insertOne(item);
  }

  async getPOIEvents(
    listKey: string,
    startIndex: number,
    endIndex?: number,
  ): Promise<POIOrderedEventDBItem[]> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };

    // Set startIndex as the min index
    const min: DBMaxMin<POIOrderedEventDBItem> = {
      index: startIndex,
    };

    // If endIndex is defined, set it as the max index
    const max: DBMaxMin<POIOrderedEventDBItem> = {};
    if (typeof endIndex !== 'undefined') {
      max.index = endIndex;
    }

    return this.findAll(filter, sort, max, min);
  }

  async getCount(listKey: string): Promise<number> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    return this.count(filter);
  }

  async getLastAddedItem(
    listKey: string,
  ): Promise<Optional<POIOrderedEventDBItem>> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'descending',
    };
    return this.findOne(filter, sort);
  }

  async eventExists(
    listKey: string,
    firstBlindedCommitment: string,
  ): Promise<boolean> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
      firstBlindedCommitment,
    };
    return this.exists(filter);
  }
}
