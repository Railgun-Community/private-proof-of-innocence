import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  getListPublicKey,
  signBlockedShield,
  signPOIEvent,
  verifyBlockedShield,
  verifyPOIEvent,
} from '../ed25519';
import {
  POIEventType,
  SignedBlockedShield,
  SignedPOIEvent,
} from '../../models/poi-types';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('ed25519', () => {
  before(() => {});

  it('Should sign and verify POI shield event', async () => {
    const index = 0;
    const signature = await signPOIEvent(index, {
      type: POIEventType.Shield,
      blindedCommitment: '0x1234',
      commitmentHash: '0x5678',
    });
    expect(signature).to.equal(
      '7ca14510fa257ed4f4aaf71e89bc80545c5fa67c70a643aef412595afa5be396a9f6ac1a36f7d683ee90e1054af613161317f11de0b44b4b3d8c8cf3147c360d',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent: SignedPOIEvent = {
      index,
      blindedCommitment: '0x1234',
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
    const signature = await signPOIEvent(index, {
      type: POIEventType.Transact,
      blindedCommitment: '0x1234',
    });
    expect(signature).to.equal(
      '7ca14510fa257ed4f4aaf71e89bc80545c5fa67c70a643aef412595afa5be396a9f6ac1a36f7d683ee90e1054af613161317f11de0b44b4b3d8c8cf3147c360d',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent: SignedPOIEvent = {
      index,
      blindedCommitment: '0x1234',
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
