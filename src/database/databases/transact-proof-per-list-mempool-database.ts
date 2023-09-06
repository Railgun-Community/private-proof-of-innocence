import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  TransactProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { TransactProofData } from '../../models/proof-types';

export class TransactProofPerListMempoolDatabase extends AbstractDatabase<TransactProofMempoolDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.TransactProofPerListMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'firstBlindedCommitmentInput'], {
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
      firstBlindedCommitmentInput: transactProofData.blindedCommitmentInputs[0],
    };
    return this.insertOne(item);
  }

  async proofExists(
    listKey: string,
    firstBlindedCommitmentInput: string,
  ): Promise<boolean> {
    const filter: DBFilter<TransactProofMempoolDBItem> = {
      listKey,
      firstBlindedCommitmentInput,
    };
    return this.exists(filter);
  }

  async deleteProof(
    listKey: string,
    firstBlindedCommitmentInput: string,
  ): Promise<void> {
    const filter: DBFilter<TransactProofMempoolDBItem> = {
      listKey,
      firstBlindedCommitmentInput,
    };
    return this.deleteOne(filter);
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
