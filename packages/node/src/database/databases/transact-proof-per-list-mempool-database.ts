import {
  NetworkName,
  TransactProofData,
} from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBStream,
  TransactProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { Filter } from 'mongodb';

export class TransactProofPerListMempoolDatabase extends AbstractDatabase<TransactProofMempoolDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.TransactProofPerListMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'firstBlindedCommitment'], {
      unique: true,
    });
  }

  async insertTransactProof(
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

  async proofExistsContainingBlindedCommitment(
    listKey: string,
    blindedCommitment: string,
  ): Promise<boolean> {
    const filter: Filter<TransactProofMempoolDBItem> = {
      listKey,
      blindedCommitmentOutputs: blindedCommitment,
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

  async streamTransactProofs(
    listKey: string,
  ): Promise<DBStream<TransactProofMempoolDBItem>> {
    const filter: DBFilter<TransactProofMempoolDBItem> = {
      listKey,
    };
    return this.stream(filter);
  }
}
