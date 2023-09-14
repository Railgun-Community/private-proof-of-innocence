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
    await this.createIndex(['listKey', 'firstBlindedCommitment'], {
      unique: true,
    });
  }

  async insertValidTransactProof(
    listKey: string,
    transactProofData: TransactProofData,
  ): Promise<void> {
    const item: TransactProofMempoolDBItem = {
      listKey,
      snarkProof: transactProofData.snarkProof,
      poiMerkleroots: transactProofData.poiMerkleroots,
      txidMerkleroot: transactProofData.txidMerkleroot,
      txidMerklerootIndex: transactProofData.txidMerklerootIndex,
      blindedCommitmentOutputs: transactProofData.blindedCommitmentOutputs,
      firstBlindedCommitment: transactProofData.blindedCommitmentOutputs[0],
    };
    return this.insertOne(item);
  }

  async proofExists(
    listKey: string,
    firstBlindedCommitment: string,
  ): Promise<boolean> {
    const filter: DBFilter<TransactProofMempoolDBItem> = {
      listKey,
      firstBlindedCommitment,
    };
    return this.exists(filter);
  }

  async deleteProof(
    listKey: string,
    firstBlindedCommitment: string,
  ): Promise<void> {
    const filter: DBFilter<TransactProofMempoolDBItem> = {
      listKey,
      firstBlindedCommitment,
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
        txidMerkleroot: transactProofDBData.txidMerkleroot,
        txidMerklerootIndex: transactProofDBData.txidMerklerootIndex,
        blindedCommitmentOutputs: transactProofDBData.blindedCommitmentOutputs,
      },
      listKey: transactProofDBData.listKey,
    }));
  }
}
