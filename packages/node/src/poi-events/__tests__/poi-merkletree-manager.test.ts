import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  BlindedCommitmentType,
  NetworkName,
  POIStatus,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { POIMerkletreeManager } from '../poi-merkletree-manager';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import { MOCK_LIST_KEYS } from '../../tests/mocks.test';
import { SignedPOIEvent } from '../../models/poi-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let merkletreeDB: POIMerkletreeDatabase;

const listKey = MOCK_LIST_KEYS[1];

describe('poi-merkletree-manager', () => {
  before(async () => {
    await DatabaseClient.init();

    merkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);

    POIMerkletreeManager.initListMerkletrees(MOCK_LIST_KEYS);
  });

  beforeEach(async () => {
    await merkletreeDB.deleteAllItems_DANGEROUS();
  });

  afterEach(async () => {
    await merkletreeDB.deleteAllItems_DANGEROUS();
  });

  it('Should add event to POI merkletree and get updated merkle proofs', async () => {
    await expect(
      POIMerkletreeManager.getMerkleProofs(listKey, networkName, txidVersion, [
        '0x1234',
      ]),
    ).to.eventually.be.rejectedWith(
      'No POI node for blinded commitment (node hash) 0x1234',
    );

    await POIMerkletreeManager.addPOIEvent(
      listKey,
      networkName,
      txidVersion,
      {
        index: 0,
        blindedCommitment: '0x1234',
      } as SignedPOIEvent,
      '1f2d42f85a78e7eb8bf6906af2b23cde914f19567f703315824aaefeac67c991', // validatedMerkleroot
    );

    await POIMerkletreeManager.addPOIEvent(
      listKey,
      networkName,
      txidVersion,
      {
        index: 1,
        blindedCommitment: '0x5678',
      } as SignedPOIEvent,
      '10667d409f91d8baec3b1532279a2343208030c0feb16bad86c6086a8c2907c6', // validatedMerkleroot
    );

    const merkleProofs = await POIMerkletreeManager.getMerkleProofs(
      listKey,
      networkName,
      txidVersion,
      ['0x1234'],
    );

    expect(merkleProofs).to.have.lengthOf(1);
    expect(merkleProofs).to.deep.equal([
      {
        elements: [
          '0x5678',
          '01c405064436affeae1fc8e30b2e417b4243bbb819adca3b55bb32efc3e43a4f',
          '0888d37652d10d1781db54b70af87b42a2916e87118f507218f9a42a58e85ed2',
          '183f531ead7217ebc316b4c02a2aad5ad87a1d56d4fb9ed81bf84f644549eaf5',
          '093c48f1ecedf2baec231f0af848a57a76c6cf05b290a396707972e1defd17df',
          '1437bb465994e0453357c17a676b9fdba554e215795ebc17ea5012770dfb77c7',
          '12359ef9572912b49f44556b8bbbfa69318955352f54cfa35cb0f41309ed445a',
          '2dc656dadc82cf7a4707786f4d682b0f130b6515f7927bde48214d37ec25a46c',
          '2500bdfc1592791583acefd050bc439a87f1d8e8697eb773e8e69b44973e6fdc',
          '244ae3b19397e842778b254cd15c037ed49190141b288ff10eb1390b34dc2c31',
          '0ca2b107491c8ca6e5f7e22403ea8529c1e349a1057b8713e09ca9f5b9294d46',
          '18593c75a9e42af27b5e5b56b99c4c6a5d7e7d6e362f00c8e3f69aeebce52313',
          '17aca915b237b04f873518947a1f440f0c1477a6ac79299b3be46858137d4bfb',
          '2726c22ad3d9e23414887e8233ee83cc51603f58c48a9c9e33cb1f306d4365c0',
          '08c5bd0f85cef2f8c3c1412a2b69ee943c6925ecf79798bb2b84e1b76d26871f',
          '27f7c465045e0a4d8bec7c13e41d793734c50006ca08920732ce8c3096261435',
        ],
        indices:
          '0000000000000000000000000000000000000000000000000000000000000000',
        leaf: '0x1234',
        root: '10667d409f91d8baec3b1532279a2343208030c0feb16bad86c6086a8c2907c6',
      },
    ]);

    const poiStatusPerList = await POIMerkletreeManager.getPOIStatusPerList(
      MOCK_LIST_KEYS,
      networkName,
      txidVersion,
      [
        { blindedCommitment: '0x1234', type: BlindedCommitmentType.Transact },
        { blindedCommitment: '0x5678', type: BlindedCommitmentType.Transact },
        { blindedCommitment: '0x1111111', type: BlindedCommitmentType.Shield },
      ],
    );
    expect(poiStatusPerList).to.deep.equal({
      '0x1234': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Missing,
        [MOCK_LIST_KEYS[1]]: POIStatus.Valid,
      },
      '0x5678': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Missing,
        [MOCK_LIST_KEYS[1]]: POIStatus.Valid,
      },
      '0x1111111': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Missing,
        [MOCK_LIST_KEYS[1]]: POIStatus.Missing,
      },
    });
  });
});
