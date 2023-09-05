import { NetworkName } from '@railgun-community/shared-models';
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
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIOrderedEvents);
  }

  async createCollectionIndices() {
    await this.createIndex(['index']);
    await this.createIndex(['index', 'listKey'], { unique: true });
  }

  async insertValidSignedPOIEvent(
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ): Promise<void> {
    const { blindedCommitments, proof, signature } = signedPOIEvent;
    const index = await this.getNextIndex();
    const item: POIOrderedEventDBItem = {
      listKey,
      index,
      blindedCommitments,
      proof,
      signature,
    };
    await this.insertOne(item);
  }

  async getPOIEvents(listKey: string, startingIndex: number) {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    const min: DBMaxMin<POIOrderedEventDBItem> = {
      index: startingIndex,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };
    return this.findAll(
      filter,
      sort,
      undefined, // max
      min,
    );
  }

  async getNextIndex(): Promise<number> {
    return this.count();
  }
}
