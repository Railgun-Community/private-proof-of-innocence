import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  TransactProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { TransactProofData } from '../../models/proof-types';

export class TransactProofPerListMempoolDatabase extends AbstractDatabase<TransactProofMempoolDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.TransactProofPerListMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'blindedCommitmentFirstInput'], {
      unique: true,
    });
  }

  async insertValidTransactProof(
    listKey: string,
    transactProofData: TransactProofData,
  ): Promise<void> {
    const item: TransactProofMempoolDBItem = {
      ...transactProofData,
      listKey,
      blindedCommitmentFirstInput: transactProofData.blindedCommitmentInputs[0],
    };
    return this.insertOne(item);
  }

  async getAllTransactProofsAndLists(): Promise<
    {
      transactProofData: TransactProofData;
      listKey: string;
    }[]
  > {
    // TODO: Add a filter based on createdAt?
    const transactProofDBDatas = await this.findAll();

    return transactProofDBDatas.map((transactProofDBData) => ({
      transactProofData: {
        snarkProof: transactProofDBData.snarkProof,
        poiMerkleroots: transactProofDBData.poiMerkleroots,
        txMerkleroot: transactProofDBData.txMerkleroot,
        blindedCommitmentInputs: transactProofDBData.blindedCommitmentInputs,
        blindedCommitmentOutputs: transactProofDBData.blindedCommitmentInputs,
      },
      listKey: transactProofDBData.listKey,
    }));
  }
}
