import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  getListPublicKey,
  signBlockedShield,
  signPOIEventShield,
  signPOIEventTransact,
  verifyBlockedShield,
  verifyPOIEvent,
} from '../ed25519';
import {
  POIEventType,
  SignedBlockedShield,
  SignedPOIEvent,
} from '../../models/poi-types';
import { MOCK_SNARK_PROOF } from '../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('ed25519', () => {
  before(() => {});

  it('Should sign and verify POI shield event', async () => {
    const index = 0;
    const blindedCommitmentStartingIndex = 1;
    const signature = await signPOIEventShield(
      index,
      blindedCommitmentStartingIndex,
      {
        type: POIEventType.Shield,
        blindedCommitment: '0x1234',
        commitmentHash: '0x5678',
      },
    );
    expect(signature).to.equal(
      '892f085ded74a3beea240448ea33735b4f1536a04bef77a999b018a244ae7d4548d0e95ee7f0779c462515cea1bbec668dbc7f582e877d8743eecf371fe31102',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent: SignedPOIEvent = {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments: ['0x1234'],
      proof: undefined,
      signature,
    };
    const verified = await verifyPOIEvent(signedPOIEvent, publicKey);
    expect(verified).to.equal(true);

    const badSignatureEvent = { ...signedPOIEvent, signature: '1234' };
    const verifiedBad = await verifyPOIEvent(badSignatureEvent, publicKey);
    expect(verifiedBad).to.equal(false);
  });

  it('Should sign and verify POI transact event', async () => {
    const index = 0;
    const blindedCommitmentStartingIndex = 1;
    const signature = await signPOIEventTransact(
      index,
      blindedCommitmentStartingIndex,
      {
        type: POIEventType.Transact,
        blindedCommitments: ['0x1234', '0x2345'],
        proof: MOCK_SNARK_PROOF,
      },
    );
    expect(signature).to.equal(
      '707a95b1c3cd8504d958748ca6b201e132e590eebea44fa5ad03a10ff496defd30769831bc22906fc6862b430ce8aefa441cc364c72e8187a53ac4fafda19f09',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent: SignedPOIEvent = {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments: ['0x1234', '0x2345'],
      proof: MOCK_SNARK_PROOF,
      signature,
    };
    const verified = await verifyPOIEvent(signedPOIEvent, publicKey);
    expect(verified).to.equal(true);

    const badSignatureEvent = { ...signedPOIEvent, signature: '1234' };
    const verifiedBad = await verifyPOIEvent(badSignatureEvent, publicKey);
    expect(verifiedBad).to.equal(false);
  });

  it('Should sign and verify Blocked Shield', async () => {
    const signature = await signBlockedShield('0x1234', '0x7890', 'test');
    expect(signature).to.equal(
      'c30432de4a09e04cdc89b8a991e2ba6dc61717cca0df3028c251329846b8d184cc06b84d1b6d384dbfab05a0ec0f272fe79a71be08e903553c639ee53b824004',
    );

    const publicKey = await getListPublicKey();

    const signedBlockedShield: SignedBlockedShield = {
      commitmentHash: '0x1234',
      blindedCommitment: '0x7890',
      blockReason: 'test',
      signature,
    };
    const verified = await verifyBlockedShield(signedBlockedShield, publicKey);
    expect(verified).to.equal(true);

    const badSignatureEvent = { ...signedBlockedShield, signature: '1234' };
    const verifiedBad = await verifyBlockedShield(badSignatureEvent, publicKey);
    expect(verifiedBad).to.equal(false);
  });
});
