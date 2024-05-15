import {
  NetworkName,
  TXIDVersion,
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
import { ByteUtils } from '@railgun-community/wallet';

export class TransactProofPerListMempoolDatabase extends AbstractDatabase<TransactProofMempoolDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.TransactProofPerListMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(
      ['listKey', 'blindedCommitmentsOut', 'railgunTxidIfHasUnshield'],
      {
        unique: true,
        name: 'lBR',
      },
    );
    await this.createIndex(['listKey', 'blindedCommitmentsOut']);
    await this.createIndex(['listKey', 'railgunTxidIfHasUnshield']);
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
      blindedCommitmentsOut: transactProofData.blindedCommitmentsOut,
      railgunTxidIfHasUnshield: transactProofData.railgunTxidIfHasUnshield,
    };
    return this.insertOne(item);
  }

  async proofExists(
    listKey: string,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ): Promise<boolean> {
    const filter: Filter<TransactProofMempoolDBItem> = {
      listKey,
      blindedCommitmentsOut, // find all - array compare in-order
      railgunTxidIfHasUnshield,
    };
    return this.exists(filter);
  }

  async getProofContainingBlindedCommitmentOut(
    listKey: string,
    blindedCommitmentOut: string,
  ): Promise<Optional<TransactProofMempoolDBItem>> {
    const filter: Filter<TransactProofMempoolDBItem> = {
      listKey,
      blindedCommitmentsOut: blindedCommitmentOut, // single compare for find-in-array
    };
    return this.findOne(filter);
  }

  async getProofContainingRailgunTxidIfHasUnshield(
    listKey: string,
    railgunTxidIfHasUnshield: string,
  ): Promise<Optional<TransactProofMempoolDBItem>> {
    if (ByteUtils.hexToBigInt(railgunTxidIfHasUnshield) === 0n) {
      return undefined;
    }
    const filter: Filter<TransactProofMempoolDBItem> = {
      listKey,
      railgunTxidIfHasUnshield,
    };
    return this.findOne(filter);
  }

  async getProofContainingBlindedCommitmentOrRailgunTxidIfHasUnshield(
    listKey: string,
    blindedCommitment: string,
  ): Promise<Optional<TransactProofMempoolDBItem>> {
    return (
      (await this.getProofContainingBlindedCommitmentOut(
        listKey,
        blindedCommitment,
      )) ??
      (await this.getProofContainingRailgunTxidIfHasUnshield(
        listKey,
        blindedCommitment,
      ))
    );
  }

  async deleteProof(
    listKey: string,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ): Promise<void> {
    const filter: Filter<TransactProofMempoolDBItem> = {
      listKey,
      blindedCommitmentsOut, // find all - array compare in-order
      railgunTxidIfHasUnshield,
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
