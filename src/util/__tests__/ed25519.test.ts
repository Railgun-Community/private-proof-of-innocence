import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { getListPublicKey, signPOIEvent, verifyPOIEvent } from '../ed25519';
import { UnsignedPOIEvent } from '../../models/poi-types';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('ed25519', () => {
  before(() => {});

  it('Should sign and verify POI Events', async () => {
    const unsignedPOIEvent: UnsignedPOIEvent = {
      index: 0,
      blindedCommitmentStartingIndex: 0,
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

    const signature = await signPOIEvent(unsignedPOIEvent);
    expect(signature).to.equal(
      'd84a6d50dc5d59987579421bd2bcbb96ae6d4d470a3e779958a9e53433dcf073b8732d4a15cbde4efb7d0af19a3f9db272c39a71b98bf5f2c214fd993257860c',
    );

    const publicKey = await getListPublicKey();

    const signedPOIEvent = { ...unsignedPOIEvent, signature };
    const verified = await verifyPOIEvent(signedPOIEvent, publicKey);
    expect(verified).to.equal(true);

    const badSignatureEvent = { ...unsignedPOIEvent, signature: '1234' };
    const verifiedBad = await verifyPOIEvent(badSignatureEvent, publicKey);
    expect(verifiedBad).to.equal(false);
  });
});
