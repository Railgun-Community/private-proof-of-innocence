import { NetworkName } from '@railgun-community/shared-models';
import { POIExistenceListMap } from '../models/api-types';

export class POILookup {
  static async getPOIExistencePerList(
    listKeys: string[],
    networkName: NetworkName,
    blindedCommitment: string,
  ): Promise<POIExistenceListMap> {
    // TODO-HIGH-PRI
    throw new Error('Unimplemented');
  }
}
