import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  getListPublicKey,
  signBlockedShield,
  signPOIEvent,
  verifyBlockedShield,
  verifyPOIEvent,
} from '../ed25519';
import { SignedBlockedShield, SignedPOIEvent } from '../../models/poi-types';
import { POIEventType } from '@railgun-community/shared-models';

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
      '0f15f110320b402670e7ff03035942a50e9bdbe75aadb4d072fa4558b00fa9df40cec69a8613f1bd75b1f271f74061c573e1e139b96ea448fc7dd1e37dbe430f',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent: SignedPOIEvent = {
      index,
      blindedCommitment: '0x1234',
      signature,
      type: POIEventType.Shield,
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
      '5a5222704715fd3ef0fc5b9d91afccd95d64998b31a11e9df8364ffa7bf4ba3e5474da9051a99b360c8651f766496b58786d7a09707487bb5c5bfcdcf88d9702',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent: SignedPOIEvent = {
      index,
      blindedCommitment: '0x1234',
      signature,
      type: POIEventType.Transact,
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
