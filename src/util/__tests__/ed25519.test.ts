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
      proof: {
        pi_a: ['0x1234', '0x5678'],
        pi_b: [
          ['0x1234', '0x5678'],
          ['0x123456', '0x567890'],
        ],
        pi_c: ['0x1234', '0x567890'],
      },
    };

    const signature = await signPOIEvent(poiEvent);
    expect(signature).to.equal(
      '96ef61bac58de958eed777b839ad72a73a4e0de7c351d011ea284c60809a76d5b081813b6db426d7d6ce5f9048baa458fb9bdf171f5f8fe5435fc51a24c32e03',
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
