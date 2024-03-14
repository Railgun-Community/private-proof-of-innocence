import {
  NetworkName,
  POIEventType,
  TXIDVersion,
  isDefined,
} from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBSort,
  POIOrderedEventDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { SignedPOIEvent } from '../../models/poi-types';
import { Filter } from 'mongodb';

export class POIOrderedEventsDatabase extends AbstractDatabase<POIOrderedEventDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.POIOrderedEvents);
  }

  async createCollectionIndices() {
    await this.createIndex(['index', 'listKey'], { unique: true });

    if (
      await this.indexExists(
        ['listKey', 'blindedCommitment'],
        true, // unique
      )
    ) {
      // Remove 'unique' index on next run.
      await this.dropIndex(['listKey', 'blindedCommitment']);
    }

    await this.createIndex(['listKey', 'blindedCommitment']);
  }

  async insertValidSignedPOIEvent(
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ): Promise<void> {
    const { index, blindedCommitment, signature, type } = signedPOIEvent;
    const item: POIOrderedEventDBItem = {
      listKey,
      index,
      blindedCommitment,
      signature,
      type,
    };
    await this.insertOne(item);
  }

  async getPOIEvents(
    listKey: string,
    startIndex: number,
    endIndex?: number,
  ): Promise<POIOrderedEventDBItem[]> {
    const filter: Filter<POIOrderedEventDBItem> = {
      listKey,
      index: isDefined(endIndex)
        ? { $gte: startIndex, $lte: endIndex }
        : { $gte: startIndex },
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };
    return this.findAll(filter, sort);
  }

  async getCount(listKey: string, type?: POIEventType): Promise<number> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    if (isDefined(type)) {
      filter.type = type;
    }
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

  async getEvent(
    listKey: string,
    blindedCommitment: string,
  ): Promise<Optional<POIOrderedEventDBItem>> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
      blindedCommitment,
    };
    return this.findOne(filter);
  }

  async eventExists(
    listKey: string,
    blindedCommitment: string,
  ): Promise<boolean> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
      blindedCommitment,
    };
    return this.exists(filter);
  }

  async streamOrdered(listKey: string) {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };
    return this.stream(filter, sort);
  }

  async deleteAllEventsForList_DANGEROUS(listKey: string) {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    return this.deleteMany(filter);
  }
}
