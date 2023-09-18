import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { POIOrderedEventsDatabase } from '../poi-ordered-events-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { SignedPOIEvent } from '../../../models/poi-types';
import { POIEventList } from '../../../poi/poi-event-list';
import { MOCK_LIST_KEYS } from '../../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: POIOrderedEventsDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('POIOrderedEventsDatabase', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new POIOrderedEventsDatabase(networkName);
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
    const indexFieldExists = indexes.some((index) => {
      return 'key' in index && 'index' in index.key;
    });

    // Check if a unique index exists for the combination of 'index' and 'listKey' fields
    const combinedIndexExists = indexes.some((index) => {
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
      blindedCommitmentStartingIndex: 0,
      blindedCommitments: ['commitment1', 'commitment2'],
      proof: {
        pi_a: ['somePi_a1', 'somePi_a2'],
        pi_b: [
          ['somePi_b11', 'somePi_b12'],
          ['somePi_b21', 'somePi_b22'],
        ],
        pi_c: ['somePi_c1', 'somePi_c2'],
      },
      signature: 'someSignature',
    };

    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);
    const events = await db.getPOIEvents(listKey, 0);

    // Check the POI event was inserted
    const retrievedEvent = events[0];
    expect(retrievedEvent.blindedCommitments).to.deep.equal(
      signedPOIEvent.blindedCommitments,
    );
    expect(retrievedEvent.proof).to.deep.equal(signedPOIEvent.proof);
    expect(retrievedEvent.signature).to.equal(signedPOIEvent.signature);

    // Call getCount and check the returned value
    const count = await db.getCount(listKey);
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
      blindedCommitmentStartingIndex: 0,
      blindedCommitments: ['commitment1', 'commitment2'],
      proof: {
        pi_a: ['somePi_a1', 'somePi_a2'],
        pi_b: [
          ['somePi_b11', 'somePi_b12'],
          ['somePi_b21', 'somePi_b22'],
        ],
        pi_c: ['somePi_c1', 'somePi_c2'],
      },
      signature: 'someSignature',
    };
    const signedPOIEvent2: SignedPOIEvent = {
      index: 1,
      blindedCommitmentStartingIndex: 0,
      blindedCommitments: ['commitment1', 'commitment2'],
      proof: {
        pi_a: ['somePi_a1', 'somePi_a2'],
        pi_b: [
          ['somePi_b11', 'somePi_b12'],
          ['somePi_b21', 'somePi_b22'],
        ],
        pi_c: ['somePi_c1', 'somePi_c2'],
      },
      signature: 'someSignature',
    };
    const signedPOIEvent3: SignedPOIEvent = {
      index: 2,
      blindedCommitmentStartingIndex: 0,
      blindedCommitments: ['commitment1', 'commitment2'],
      proof: {
        pi_a: ['somePi_a1', 'somePi_a2'],
        pi_b: [
          ['somePi_b11', 'somePi_b12'],
          ['somePi_b21', 'somePi_b22'],
        ],
        pi_c: ['somePi_c1', 'somePi_c2'],
      },
      signature: 'someSignature',
    };

    // Insert three events into the database
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent1);
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent2);
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent3);

    // Fetch POI events with endIndex
    const events = await db.getPOIEvents(listKey, startIndex, endIndex);

    // Retrieve only the 2nd event
    const eventRange = await POIEventList.getPOIListEventRange(
      networkName,
      listKey,
      1,
      2,
    );
    expect(eventRange).to.deep.equal([signedPOIEvent2]);

    // Check that the length of the events is as expected
    expect(events.length).to.equal(3);
  });

  it('Should correctly fetch the last added item', async () => {
    const signedPOIEvent1: SignedPOIEvent = {
      index: 0,
      blindedCommitmentStartingIndex: 0,
      blindedCommitments: ['commitment1', 'commitment2'],
      proof: {
        pi_a: ['somePi_a1', 'somePi_a2'],
        pi_b: [
          ['somePi_b11', 'somePi_b12'],
          ['somePi_b21', 'somePi_b22'],
        ],
        pi_c: ['somePi_c1', 'somePi_c2'],
      },
      signature: 'someSignature',
    };
    const signedPOIEvent2: SignedPOIEvent = {
      index: 1,
      blindedCommitmentStartingIndex: 0,
      blindedCommitments: ['commitment1', 'commitment2'],
      proof: {
        pi_a: ['somePi_a1', 'somePi_a2'],
        pi_b: [
          ['somePi_b11', 'somePi_b12'],
          ['somePi_b21', 'somePi_b22'],
        ],
        pi_c: ['somePi_c1', 'somePi_c2'],
      },
      signature: 'someSignature',
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
      expect(lastAddedItem.blindedCommitments).to.deep.equal(
        signedPOIEvent2.blindedCommitments,
      );
      expect(lastAddedItem.proof).to.deep.equal(signedPOIEvent2.proof);
      expect(lastAddedItem.signature).to.equal(signedPOIEvent2.signature);
    }
  });
});
