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
    const { snarkProof, publicInputs } = transactProofData;
    const {
      poiMerkleroots,
      txMerkleroot,
      blindedCommitmentInputs,
      blindedCommitmentOutputs,
    } = publicInputs;

    const item: TransactProofMempoolDBItem = {
      listKey,
      snarkProof,
      poiMerkleroots,
      txMerkleroot,
      blindedCommitmentInputs,
      blindedCommitmentOutputs,
      blindedCommitmentFirstInput: blindedCommitmentInputs[0],
    };
    return this.insertOne(item);
  }
}
