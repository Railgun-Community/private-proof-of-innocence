import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
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
    await this.createIndex(['index'], { unique: true });
  }

  async insertValidSignedPOIEvent(
    signedPOIEvent: SignedPOIEvent,
  ): Promise<void> {
    const { blindedCommitments, proof, signature } = signedPOIEvent;
    const index = await this.getNextIndex();
    const item: POIOrderedEventDBItem = {
      index,
      blindedCommitments,
      proof,
      signature,
    };
    await this.insertOne(item);
  }

  async getPOIEvents(startingIndex: number) {
    const min: DBMaxMin<POIOrderedEventDBItem> = {
      index: startingIndex,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };
    return this.findAll(
      undefined, // filter
      sort,
      undefined, // max
      min,
    );
  }

  async getNextIndex(): Promise<number> {
    return (await this.count()) + 1;
  }
}
