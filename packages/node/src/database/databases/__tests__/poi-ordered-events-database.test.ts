import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { POIOrderedEventsDatabase } from '../poi-ordered-events-database';
import {
  NetworkName,
  POIEventType,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { SignedPOIEvent } from '../../../models/poi-types';
import { POIEventList } from '../../../poi-events/poi-event-list';
import { MOCK_LIST_KEYS } from '../../../tests/mocks.test';
import { POIMerkletreeManager } from '../../../poi-events/poi-merkletree-manager';
import { POIHistoricalMerklerootDatabase } from '../poi-historical-merkleroot-database';
import { POIMerkletreeDatabase } from '../poi-merkletree-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let poiEventsDB: POIOrderedEventsDatabase;
let poiMerkletreeDB: POIMerkletreeDatabase;
let poiMerklerootDB: POIHistoricalMerklerootDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('poi-ordered-events-database', () => {
  before(async () => {
    await DatabaseClient.init();
    POIMerkletreeManager.initListMerkletrees([listKey]);
    poiEventsDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    await poiEventsDB.createCollectionIndices();
    poiMerkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    poiMerklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
  });

  beforeEach(async () => {
    await poiEventsDB.deleteAllItems_DANGEROUS();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
    await poiMerklerootDB.deleteAllItems_DANGEROUS();
  });

  it('Should correctly initialize POIOrderedEventsDatabase', () => {
    expect(poiEventsDB).to.be.instanceOf(POIOrderedEventsDatabase);
  });

  it('Should create collection indices', async () => {
    // Fetch all indexes for the collection
    const indexes = await poiEventsDB.listCollectionIndexes();

    // Check if an index exists for the 'index' field
    const indexFieldExists = indexes.some(index => {
      return 'key' in index && 'index' in index.key;
    });

    // Check if a unique index exists for the combination of 'index' and 'listKey' fields
    const combinedIndexExists = indexes.some(index => {
      return (
        'key' in index &&
        'index' in index.key &&
        'listKey' in index.key &&
        index.unique === true
      );
    });

    expect(indexFieldExists).to.equal(true);
    expect(combinedIndexExists).to.equal(true);
  });

  it('Should insert and get a valid POI signed event', async () => {
    const signedPOIEvent: SignedPOIEvent = {
      index: 0,
      blindedCommitment: 'commitment_1',
      signature: 'someSignature',
      type: POIEventType.Shield,
    };

    await poiEventsDB.insertValidSignedPOIEvent(listKey, signedPOIEvent);
    const events = await poiEventsDB.getPOIEvents(listKey, 0);
    expect(events.length).to.equal(1);

    // Check the POI event was inserted
    const retrievedEvent = events[0];
    expect(retrievedEvent.blindedCommitment).to.equal(
      signedPOIEvent.blindedCommitment,
    );
    expect(retrievedEvent.signature).to.equal(signedPOIEvent.signature);

    // Call getCount and check the returned value
    const count = await poiEventsDB.getCount(listKey, POIEventType.Shield);
    expect(count).to.equal(1);
  });

  it('Should fetch POI events with a given listKey and startingIndex', async () => {
    const events = await poiEventsDB.getPOIEvents(listKey, 0);
    expect(events.length).to.equal(0);
  });

  it('Should fetch POI events with a given listKey, startingIndex and endIndex', async () => {
    const startIndex = 0;
    const endIndex = 3;

    const signedPOIEvent0: SignedPOIEvent = {
      index: 0,
      blindedCommitment: '0x1234',
      signature: 'someSignature',
      type: POIEventType.Shield,
    };
    const signedPOIEvent1: SignedPOIEvent = {
      index: 1,
      blindedCommitment: '0x5678',
      signature: 'someSignature',
      type: POIEventType.Shield,
    };
    const signedPOIEvent2: SignedPOIEvent = {
      index: 2,
      blindedCommitment: '0x7890',
      signature: 'someSignature',
      type: POIEventType.Shield,
    };

    await POIEventList.addValidSignedPOIEventOwnedList(
      listKey,
      networkName,
      txidVersion,
      signedPOIEvent0,
    );
    await POIEventList.addValidSignedPOIEventOwnedList(
      listKey,
      networkName,
      txidVersion,
      signedPOIEvent1,
    );
    await POIEventList.addValidSignedPOIEventOwnedList(
      listKey,
      networkName,
      txidVersion,
      signedPOIEvent2,
    );

    // Fetch POI events with endIndex
    const events = await poiEventsDB.getPOIEvents(
      listKey,
      startIndex,
      endIndex,
    );

    // Check that the length of the events is as expected
    expect(events.length).to.equal(3);

    // Retrieve only the 2nd event
    const eventRange = await POIEventList.getPOIListEventRange(
      listKey,
      networkName,
      txidVersion,
      1,
      2,
    );
    expect(eventRange).to.deep.equal([
      {
        signedPOIEvent: signedPOIEvent1,
        validatedMerkleroot:
          '10667d409f91d8baec3b1532279a2343208030c0feb16bad86c6086a8c2907c6',
      },
      {
        signedPOIEvent: signedPOIEvent2,
        validatedMerkleroot:
          '2f5b7acae7fa92d7c4ba47c29ce34f31865c616946cef14fcb56a177f37ed628',
      },
    ]);
  });

  it('Should correctly fetch the last added item', async () => {
    const signedPOIEvent1: SignedPOIEvent = {
      index: 0,
      blindedCommitment: 'commitment_1',
      signature: 'someSignature',
      type: POIEventType.Shield,
    };
    const signedPOIEvent2: SignedPOIEvent = {
      index: 1,
      blindedCommitment: 'commitment_2',
      signature: 'someSignature',
      type: POIEventType.Transact,
    };

    // Insert two events into the database
    await poiEventsDB.insertValidSignedPOIEvent(listKey, signedPOIEvent1);
    await poiEventsDB.insertValidSignedPOIEvent(listKey, signedPOIEvent2);

    // Fetch the last added item
    const lastAddedItem = await poiEventsDB.getLastAddedItem(listKey);

    // Check that the last added item is as expected
    expect(lastAddedItem).to.not.be.null;
    expect(lastAddedItem).to.not.be.undefined;
    if (lastAddedItem !== null && lastAddedItem !== undefined) {
      expect(lastAddedItem.index).to.equal(signedPOIEvent2.index);
      expect(lastAddedItem.blindedCommitment).to.deep.equal(
        signedPOIEvent2.blindedCommitment,
      );
      expect(lastAddedItem.signature).to.equal(signedPOIEvent2.signature);
    }
  });
});
