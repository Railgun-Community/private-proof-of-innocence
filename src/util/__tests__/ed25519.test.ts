import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { getListPublicKey, signPOIEvent, verifyPOIEvent } from '../ed25519';
import { POIEvent } from '../../models/poi-types';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('ed25519', () => {
  before(() => {});

  it('Should sign and verify POI Events', async () => {
    const poiEvent: POIEvent = {
      index: 0,
      blindedCommitments: ['0x1234', '0x5678'],
      proof: { a: '0x1234', b: ['0x123456', '0x567890'], c: '0x5678' },
    };

    const signature = await signPOIEvent(poiEvent);
    expect(signature).to.equal(
      '95363a2ff4e9d3098169b13512d442db29d78a87ffbea2dfe27166b10cfcff3d7d08251cb105c070773c51319508a015e4d6d0967fd01173f72cbd97f32ccd00',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent = { ...poiEvent, signature };
    const verified = await verifyPOIEvent(signedPOIEvent, publicKey);
    expect(verified).to.equal(true);

    const badSignatureEvent = { ...poiEvent, signature: '1234' };
    const verifiedBad = await verifyPOIEvent(badSignatureEvent, publicKey);
    expect(verifiedBad).to.equal(false);
  });
});
