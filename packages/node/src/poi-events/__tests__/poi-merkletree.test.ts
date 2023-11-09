import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { POIMerkletree } from '../poi-merkletree';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import Sinon from 'sinon';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { MOCK_LIST_KEYS } from '../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let merkletreeDB: POIMerkletreeDatabase;
let merklerootDB: POIHistoricalMerklerootDatabase;
let merkletree: POIMerkletree;

const listKey = MOCK_LIST_KEYS[0];

describe('poi-merkletree', () => {
  before(async () => {
    await DatabaseClient.init();
    merkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    await merkletreeDB.createCollectionIndices();
    merklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    merkletree = new POIMerkletree(networkName, txidVersion, listKey);
  });

  beforeEach(async () => {
    await merkletree.deleteNodes_DANGEROUS(0);
  });

  it('Should calculate zero values', () => {
    const testVector = [
      '0488f89b25bc7011eaf6a5edce71aeafb9fe706faa3c0a5cd9cbe868ae3b9ffc',
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
      '14fceeac99eb8419a2796d1958fc2050d489bf5a3eb170ef16a667060344ba90',
    ];
    expect(merkletree.zeros).to.deep.equal(testVector);
  });

  it('Should get empty merkletree root', async () => {
    expect(await merkletree.getRoot(0)).to.equal(
      '14fceeac99eb8419a2796d1958fc2050d489bf5a3eb170ef16a667060344ba90',
    );
  });

  it('Should update merkle tree correctly', async () => {
    expect(await merkletree.getRoot(0)).to.equal(
      '14fceeac99eb8419a2796d1958fc2050d489bf5a3eb170ef16a667060344ba90',
    );

    await merkletree.insertLeaf(
      0,
      'ab2f9d1ebd74c3e1f1ccee452a80ae27a94f14a542a4fd8b0c9ad9a1b7f9ffe5',
      '2b6de07658fdb3b15b7fd96fdcf59d44bdef9eb20dc8beb2b5ac6d8bf9f011b1', // validatedMerkleroot
    );
    expect(await merkletree.getRoot(0)).to.equal(
      '2b6de07658fdb3b15b7fd96fdcf59d44bdef9eb20dc8beb2b5ac6d8bf9f011b1',
    );
    expect(
      await merklerootDB.getMerklerootByGlobalLeafIndex(listKey, 0),
    ).to.deep.equal({
      listKey,
      rootHash:
        '2b6de07658fdb3b15b7fd96fdcf59d44bdef9eb20dc8beb2b5ac6d8bf9f011b1',
      index: 0,
    });

    // Same leaf - error
    await expect(
      merkletree.insertLeaf(
        1,
        'ab2f9d1ebd74c3e1f1ccee452a80ae27a94f14a542a4fd8b0c9ad9a1b7f9ffe5',
        '2b6de07658fdb3b15b7fd96fdcf59d44bdef9eb20dc8beb2b5ac6d8bf9f011b1', // validatedMerkleroot
      ),
    ).to.eventually.be.rejectedWith(
      'Previous leaf has the same node hash - invalid entry',
    );

    await merkletree.insertLeaf(
      1,
      '071f842dbbae18082c04bfd08f4a56d71e1444317bfc6417dae8ac604d9493de',
      '141baa90d97e062336fd433ba9ef26f949627b12fcc8849c2c1bd70b8355a489', // validatedMerkleroot
    );
    expect(await merkletree.getRoot(0)).to.equal(
      '141baa90d97e062336fd433ba9ef26f949627b12fcc8849c2c1bd70b8355a489',
    );
    expect(
      await merklerootDB.getMerklerootByGlobalLeafIndex(listKey, 1),
    ).to.deep.equal({
      listKey,
      rootHash:
        '141baa90d97e062336fd433ba9ef26f949627b12fcc8849c2c1bd70b8355a489',
      index: 1,
    });

    await merkletree.rebuildTree(0);
    expect(await merkletree.getRoot(0)).to.equal(
      '141baa90d97e062336fd433ba9ef26f949627b12fcc8849c2c1bd70b8355a489',
    );

    await merkletree.insertMultipleLeaves_TEST_ONLY(2, [
      '8902638fe6fc05e4f1cd7c06940d6217591a0ccb003ed45198782fbff38e9f2d',
      '19889087c2ff4c4a164060a832a3ba11cce0c2e2dbd42da10c57101efb966fcd',
    ]);

    expect(await merkletree.getTreeLength(0)).to.equal(4);
    expect(await merkletree.getRoot(0)).to.equal(
      '1cecd47eb0f6ad9d3bf093a36a1dd5a0863530c40dd4adbc637d7450ee50dff1',
    );
    expect(
      await merklerootDB.merklerootExists(
        listKey,
        '1cecd47eb0f6ad9d3bf093a36a1dd5a0863530c40dd4adbc637d7450ee50dff1',
      ),
    ).to.equal(true);

    expect(
      await merklerootDB.getMerklerootByGlobalLeafIndex(listKey, 3),
    ).to.deep.equal({
      listKey,
      rootHash:
        '1cecd47eb0f6ad9d3bf093a36a1dd5a0863530c40dd4adbc637d7450ee50dff1',
      index: 3,
    });

    await merkletree.rebuildTree(0);

    expect(await merkletree.getTreeLength(0)).to.equal(4);
    expect(await merkletree.getRoot(0)).to.equal(
      '1cecd47eb0f6ad9d3bf093a36a1dd5a0863530c40dd4adbc637d7450ee50dff1',
    );

    expect(
      await merkletree.nodeHashExists(
        '8902638fe6fc05e4f1cd7c06940d6217591a0ccb003ed45198782fbff38e9f2d',
      ),
    ).to.equal(true);
  }).timeout(10000);

  it('Should create second merkle tree when first is filled', async () => {
    // Stub getNextTreeAndIndex to return last index of first tree
    const treeLengthStub = Sinon.stub(
      POIMerkletree.prototype,
      'getNextTreeAndIndex',
    ).resolves({ tree: 0, index: 65535 });

    await expect(
      merkletree.insertMultipleLeaves_TEST_ONLY(65536, []),
    ).to.eventually.be.rejectedWith(
      '[Warning] Invalid eventIndex 65536 for POI merkletree insert - next expected 65535',
    );

    await merkletree.insertMultipleLeaves_TEST_ONLY(65535, [
      '65536',
      'ab2f9d1ebd74c3e1f1ccee452a80ae27a94f14a542a4fd8b0c9ad9a1b7f9ffe5',
      '8902638fe6fc05e4f1cd7c06940d6217591a0ccb003ed45198782fbff38e9f2d',
      '19889087c2ff4c4a164060a832a3ba11cce0c2e2dbd42da10c57101efb966fcd',
    ]);

    expect(await merkletree.getRoot(1)).to.equal(
      '1bf92404b5bebd9e2c41a9d4cd55d9c9b369b0eab5fc1f9643ec1e60c75ab763',
    );

    treeLengthStub.restore();
  });

  it('Should generate and validate merkle proofs', async () => {
    await merkletree.insertMultipleLeaves_TEST_ONLY(0, [
      '02',
      '04',
      '08',
      '10',
      '20',
      '40',
    ]);

    // Get proof
    const proof = await merkletree.getMerkleProof(0, 3);

    // Check proof is what we expect
    expect(proof).to.deep.equal({
      leaf: '10',
      elements: [
        '08',
        '022678592fe7f282774b001df184b9448e46f7bc5b4d879f7f545a09f6e77feb',
        '071f842dbbae18082c04bfd08f4a56d71e1444317bfc6417dae8ac604d9493de',
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
        '0000000000000000000000000000000000000000000000000000000000000003',
      root: '215b6e027da417c086db7e55d19c6d2cc270a0c2d54a2b2cd9ae8d40d0c250b3',
    });

    // Check proof verification
    expect(POIMerkletree.verifyProof(proof)).to.equal(true);

    // Reset
    await merkletree.deleteNodes_DANGEROUS(0);

    // Insert 600 leaves
    const nums = Array.from(Array(600).keys());
    const nodeHashes: string[] = nums.map(num => {
      return BigInt(num).toString(16);
    });
    await merkletree.insertMultipleLeaves_TEST_ONLY(0, nodeHashes);

    // Get proof
    const proof2 = await merkletree.getMerkleProofFromNodeHash('22');

    expect(proof2.root).to.not.equal(proof.root);
    // Check proof is what we expect
    expect(proof2).to.deep.equal({
      leaf: '22',
      elements: [
        '23',
        '247cfdf15ecc8d7a4ef60dd8b7820179192255dd4beaa88c54343c700d13a189',
        '1794b7d113df3e3faa29d83bad231e7ea7d51d00815edd2ff28097d3c492aa0c',
        '17081a99ce40d1c5d003f01a462f1c562b7bc270670e456c8dff88e179522ee8',
        '0ae1aa1fcfa979118582a0485d05c90a60f78d5363e87ee31a52c945ffd3144b',
        '00bd653e9610271024856584fe987a628ca86f800a887dc02cbb1b902db64f29',
        '1368af2e95b983d71c23b33fc74311a495435281e090b33a763ef3fa0968bfca',
        '1547779f3b40b10f4928f34d82f57aaa095e0a7c3d3085bb2a2ae5162a410d7e',
        '270ddd6ee97cdf21d4d9172cb584812a7cfe0fd2aa40f0b8d352a1052cbf5ac4',
        '1fdbd35bf83f6aa6987aa8301fbec0539414bd42871feb8bf9bb5c7bf04cb667',
        '0ca2b107491c8ca6e5f7e22403ea8529c1e349a1057b8713e09ca9f5b9294d46',
        '18593c75a9e42af27b5e5b56b99c4c6a5d7e7d6e362f00c8e3f69aeebce52313',
        '17aca915b237b04f873518947a1f440f0c1477a6ac79299b3be46858137d4bfb',
        '2726c22ad3d9e23414887e8233ee83cc51603f58c48a9c9e33cb1f306d4365c0',
        '08c5bd0f85cef2f8c3c1412a2b69ee943c6925ecf79798bb2b84e1b76d26871f',
        '27f7c465045e0a4d8bec7c13e41d793734c50006ca08920732ce8c3096261435',
      ],
      indices:
        '0000000000000000000000000000000000000000000000000000000000000022',
      root: '1abfe84b40d5fbbebf8fce3a5838633f6f4de4d6a63c5a26c3eed8001e00e587',
    });

    // Check proof verification
    expect(POIMerkletree.verifyProof(proof2)).to.equal(true);
    proof2.root = proof.root;
    expect(POIMerkletree.verifyProof(proof2)).to.equal(false);
    proof2.elements = proof.elements;
    expect(POIMerkletree.verifyProof(proof2)).to.equal(false);
  }).timeout(10000);
});
