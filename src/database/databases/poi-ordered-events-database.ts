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
    await this.createIndex(['index', 'listKey'], { unique: true });
    await this.createIndex(['index']);
    await this.createIndex(['listKey']);
    await this.createIndex(['firstBlindedCommitmentInput']);
  }

  async insertValidSignedPOIEvent(
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ): Promise<void> {
    const { index, blindedCommitments, proof, signature } = signedPOIEvent;
    const item: POIOrderedEventDBItem = {
      listKey,
      index,
      blindedCommitments,
      firstBlindedCommitmentInput: blindedCommitments[0],
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
    const max: DBMaxMin<POIOrderedEventDBItem> = {
      index: endIndex,
    };
    const min: DBMaxMin<POIOrderedEventDBItem> = {
      index: startIndex,
    };
    return this.findAll(filter, sort, max, min);
  }

  async getCount(listKey: string): Promise<number> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    return this.count(filter);
  }

  async eventExists(
    listKey: string,
    firstBlindedCommitmentInput: string,
  ): Promise<boolean> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
      firstBlindedCommitmentInput,
    };
    return this.exists(filter);
  }
}
