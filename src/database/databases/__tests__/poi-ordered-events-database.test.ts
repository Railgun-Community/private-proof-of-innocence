import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { POIOrderedEventsDatabase } from '../poi-ordered-events-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';
import { SignedPOIEvent } from '../../../models/poi-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: POIOrderedEventsDatabase;

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
        const indexes = await db.getCollectionIndexes();

        // Check if an index exists for the 'index' field
        const indexFieldExists = indexes.some(index => {
            return 'key' in index && 'index' in index.key;
        });

        // Check if a unique index exists for the combination of 'index' and 'listKey' fields
        const combinedIndexExists = indexes.some(index => {
            return 'key' in index &&
                'index' in index.key &&
                'listKey' in index.key &&
                index.unique === true;
        });

        expect(indexFieldExists).to.equal(true);
        expect(combinedIndexExists).to.equal(true);
    });

    it('Should insert and get a valid POI signed event', async () => {
        const listKey = 'someListKey';
        const signedPOIEvent: SignedPOIEvent = {
            index: 0,
            blindedCommitments: ['commitment1', 'commitment2'],
            proof: {
                a: 'someA',
                b: ['someB', 'someB'],
                c: 'someC',
            },
            signature: 'someSignature',
        };

        await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);
        const events = await db.getPOIEvents(listKey, 0);

        // Check the POI event was inserted
        const retrievedEvent = events[0];
        expect(retrievedEvent.blindedCommitments).to.deep.equal(signedPOIEvent.blindedCommitments);
        expect(retrievedEvent.proof).to.deep.equal(signedPOIEvent.proof);
        expect(retrievedEvent.signature).to.equal(signedPOIEvent.signature);

        // Check that the index of the retrieved event is as expected
        const nextIndex = await db.getNextIndex();
        expect(retrievedEvent.index).to.equal(nextIndex - 1);  // Assumes one item has been inserted
    });

    it('Should fetch POI events with a given listKey and startingIndex', async () => {
        const listKey = 'someListKey';
        const events = await db.getPOIEvents(listKey, 0);

        expect(events.length).to.equal(0);
    });

    it('Should get the next index', async () => {
        const nextIndex = await db.getNextIndex();
        expect(nextIndex).to.equal(0);
    });
});
