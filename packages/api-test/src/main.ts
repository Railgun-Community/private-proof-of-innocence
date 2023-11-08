import debug from 'debug';
import { POINodeRequest } from './poi-node-request';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';

const dbg = debug('api-test:main');

const main = async () => {
  try {
    const nodeURL = 'http://localhost:8080';
    const eventRange = await POINodeRequest.getPOIListEventRange(
      nodeURL,
      NetworkName.Ethereum,
      TXIDVersion.V2_PoseidonMerkle,
      'efc6ddb59c098a13fb2b618fdae94c1c3a807abc8fb1837c93620c9143ee9e88',
      11638,
      11643,
    );
    dbg(eventRange);
  } catch (err) {
    dbg(err);
  }
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
