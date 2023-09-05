import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIOrderedEventDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class POIOrderedEventsDatabase extends AbstractDatabase<POIOrderedEventDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIOrderedEvents);
  }

  async createCollectionIndex() {
    await this.createIndex({ index: 1 }, { unique: true });
  }
}
