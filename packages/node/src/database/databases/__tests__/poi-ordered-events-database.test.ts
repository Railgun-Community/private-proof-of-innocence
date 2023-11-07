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

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: POIOrderedEventsDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('poi-ordered-events-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new POIOrderedEventsDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should correctly initialize POIOrderedEventsDatabase', () => {
    expect(db).to.be.instanceOf(POIOrderedEventsDatabase);
  });

  it('Should create collection indices', async () => {
    // Fetch all indexes for the collection
    const indexes = await db.listCollectionIndexes();

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

    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);
    const events = await db.getPOIEvents(listKey, 0);

    // Check the POI event was inserted
    const retrievedEvent = events[0];
    expect(retrievedEvent.blindedCommitment).to.equal(
      signedPOIEvent.blindedCommitment,
    );
    expect(retrievedEvent.signature).to.equal(signedPOIEvent.signature);

    // Call getCount and check the returned value
    const count = await db.getCount(listKey, POIEventType.Shield);
    expect(count).to.equal(1);
  });

  it('Should fetch POI events with a given listKey and startingIndex', async () => {
    const events = await db.getPOIEvents(listKey, 0);

    expect(events.length).to.equal(0);
  });

  it('Should fetch POI events with a given listKey, startingIndex and endIndex', async () => {
    const startIndex = 0;
    const endIndex = 3; // NOTE: endIndex is exclusive

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
      type: POIEventType.Shield,
    };
    const signedPOIEvent3: SignedPOIEvent = {
      index: 2,
      blindedCommitment: 'commitment_3',
      signature: 'someSignature',
      type: POIEventType.Shield,
    };

    // Insert three events into the database
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent1);
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent2);
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent3);

    // Fetch POI events with endIndex
    const events = await db.getPOIEvents(listKey, startIndex, endIndex);

    // Retrieve only the 2nd event
    const eventRange = await POIEventList.getPOIListEventRange(
      listKey,
      networkName,
      txidVersion,
      1,
      2,
    );
    expect(eventRange).to.deep.equal([
      { signedPOIEvent: signedPOIEvent2, validatedMerkleroot: '0x5678' },
    ]);

    // Check that the length of the events is as expected
    expect(events.length).to.equal(3);
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
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent1);
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent2);

    // Fetch the last added item
    const lastAddedItem = await db.getLastAddedItem(listKey);

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
