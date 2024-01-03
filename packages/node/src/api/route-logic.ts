import {
  GetBlockedShieldsParams,
  GetLatestValidatedRailgunTxidParams,
  GetMerkleProofsParams,
  GetPOIsPerListParams,
  GetTransactProofsParams,
  SubmitLegacyTransactProofParams,
  SubmitSingleCommitmentProofsParams,
  SubmitTransactProofParams,
  TXIDVersion,
  ValidatePOIMerklerootsParams,
  ValidateTxidMerklerootParams,
  isDefined,
} from '@railgun-community/shared-models';
import {
  networkNameForSerializedChain,
  nodeURLForListKey,
} from '../config/general';
import { NodeStatus } from '../status/node-status';
import {
  GetLegacyTransactProofsParams,
  GetPOIListEventRangeParams,
  GetPOIMerkletreeLeavesParams,
  GetPOIsPerBlindedCommitmentParams,
  RemoveTransactProofParams,
  SubmitPOIEventParams,
  SubmitValidatedTxidAndMerklerootParams,
} from '../models/poi-types';
import { POINodeRequest } from './poi-node-request';
import { QueryLimits } from '../config/query-limits';
import { POIEventList } from '../poi-events/poi-event-list';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';
import { BlockedShieldsSyncer } from '../shields/blocked-shields-syncer';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';
import { SingleCommitmentProofManager } from '../single-commitment-proof/single-commitment-proof-manager';
import debug from 'debug';
import os from 'os';

/**
 * Logic for / route
 *
 * @returns Status object
 */
export const getStatus = () => {
  return { status: 'ok' };
};

export const getNodeStatus_ROUTE = async (listKeys: string[]) => {
  console.log('inside getNodeStatus_ROUTE');
  return NodeStatus.getNodeStatusAllNetworks(
    listKeys,
    TXIDVersion.V2_PoseidonMerkle,
  );
};

/**
 * Get the node status for a listKey
 *
 * @param params - Params to validate from JSON RPC request
 * @returns Function that returns a promise of the node status
 */
export const getNodeStatusListKey = async (listKey: string) => {
  console.log('Inside getNodeStatusListKey');

  const nodeURL = nodeURLForListKey(listKey);

  if (!isDefined(nodeURL)) {
    throw new Error('Cannot connect to listKey');
  }

  return POINodeRequest.getNodeStatusAllNetworks(nodeURL);
};

export const getPerformanceMetrics = () => {
  return {
    time: new Date(),
    memoryUsage: process.memoryUsage(),
    freemem: os.freemem(),
    loadavg: os.loadavg(),
  };
};

export const getPoiEvents = async (
  chainType: string,
  chainID: string,
  params: GetPOIListEventRangeParams,
) => {
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const rangeLength = params.endIndex - params.startIndex;
  if (rangeLength > QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH) {
    throw new Error(
      `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`,
    );
  }
  if (rangeLength < 0) {
    throw new Error(`Invalid query range`);
  }

  const events = await POIEventList.getPOIListEventRange(
    params.listKey,
    networkName,
    params.txidVersion,
    params.startIndex,
    params.endIndex,
  );
  return events;
};

export const getPOIMerkletreeLeaves = async (
  chainType: string,
  chainID: string,
  params: GetPOIMerkletreeLeavesParams,
) => {
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const rangeLength = params.endIndex - params.startIndex;
  if (rangeLength > QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH) {
    throw new Error(
      `Max event query range length is ${QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH}`,
    );
  }
  if (rangeLength < 0) {
    throw new Error(`Invalid query range`);
  }

  const events = await POIMerkletreeManager.getPOIMerkletreeLeaves(
    params.listKey,
    networkName,
    params.txidVersion,
    params.startIndex,
    params.endIndex,
  );
  return events;
};

export const getTransactProofs = (
  chainType: string,
  chainID: string,
  params: GetTransactProofsParams,
) => {
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const proofs = TransactProofMempool.getFilteredProofs(
    params.listKey,
    networkName,
    params.txidVersion,
    params.bloomFilterSerialized,
  );
  return proofs;
};

export const getLegacyTransactProofs = (
  chainType: string,
  chainID: string,
  params: GetLegacyTransactProofsParams,
) => {
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const proofs = LegacyTransactProofMempool.getFilteredProofs(
    networkName,
    params.txidVersion,
    params.bloomFilterSerialized,
  );
  return proofs;
};

export const getBlockedShields = (
  chainType: string,
  chainID: string,
  params: GetBlockedShieldsParams,
) => {
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const proofs = BlockedShieldsSyncer.getFilteredBlockedShields(
    params.txidVersion,
    params.listKey,
    networkName,
    params.bloomFilterSerialized,
  );
  return proofs;
};

export const submitPOIEvent = async (
  chainType: string,
  chainID: string,
  params: SubmitPOIEventParams,
  dbg: debug.Debugger,
) => {
  const { txidVersion, listKey, signedPOIEvent, validatedMerkleroot } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  dbg(`REQUEST: Submit Signed POI Event: ${listKey}, ${signedPOIEvent.index}`);

  // Submit and verify the proof
  await POIEventList.verifyAndAddSignedPOIEventsWithValidatedMerkleroots(
    listKey,
    networkName,
    txidVersion,
    [{ signedPOIEvent, validatedMerkleroot }],
  );
};

export const submitValidatedTxidAndMerkleroot = async (
  chainType: string,
  chainID: string,
  params: SubmitValidatedTxidAndMerklerootParams,
  dbg: debug.Debugger,
) => {
  const { txidVersion, txidIndex, merkleroot, signature, listKey } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  dbg(`REQUEST: Submit Validated TXID: ${txidIndex}`);

  // Submit and verify the proof
  await RailgunTxidMerkletreeManager.verifySignatureAndUpdateValidatedRailgunTxidStatus(
    networkName,
    txidVersion,
    txidIndex,
    merkleroot,
    signature,
    listKey,
  );
};

export const removeTransactProof = async (
  chainType: string,
  chainID: string,
  params: RemoveTransactProofParams,
  dbg: debug.Debugger,
) => {
  const {
    txidVersion,
    listKey,
    blindedCommitmentsOut,
    railgunTxidIfHasUnshield,
    signature,
  } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  dbg(
    `REQUEST: Remove Transact Proof: ${listKey} - blindedCommitmentsOut ${blindedCommitmentsOut.join(
      ',',
    )}`,
  );

  await TransactProofMempoolPruner.removeProofSigned(
    listKey,
    networkName,
    txidVersion,
    blindedCommitmentsOut,
    railgunTxidIfHasUnshield,
    signature,
  );
};

export const submitTransactProof = async (
  chainType: string,
  chainID: string,
  params: SubmitTransactProofParams,
  dbg: debug.Debugger,
) => {
  const { txidVersion, listKey, transactProofData } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  dbg(
    `REQUEST: Submit Transact Proof: ${listKey} - ${transactProofData.blindedCommitmentsOut.join(
      ', ',
    )}`,
  );

  // Submit and verify the proof
  await TransactProofMempool.submitProof(
    listKey,
    networkName,
    txidVersion,
    transactProofData,
  );
};

export const submitLegacyTransactProofs = async (
  chainType: string,
  chainID: string,
  params: SubmitLegacyTransactProofParams,
  dbg: debug.Debugger,
) => {
  const { txidVersion, listKeys, legacyTransactProofDatas } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  // NOTE: this used to print the unfiltered listKeys, but filteredListKeys is now passed in as listKeys
  dbg(
    `REQUEST: Submit Legacy Transact Proof: ${listKeys.join(
      ', ',
    )} - ${legacyTransactProofDatas.map(d => d.blindedCommitment).join(', ')}`,
  );

  // Submit and verify the proofs
  await Promise.all(
    legacyTransactProofDatas.map(async legacyTransactProofData => {
      await LegacyTransactProofMempool.submitLegacyProof(
        networkName,
        txidVersion,
        legacyTransactProofData,
        listKeys,
      );
    }),
  );
};

export const submitSingleCommitmentProofs = async (
  chainType: string,
  chainID: string,
  params: SubmitSingleCommitmentProofsParams,
  dbg: debug.Debugger,
) => {
  const { txidVersion, singleCommitmentProofsData } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  dbg(
    `REQUEST: Submit Single Commitment (Transact) Proof: railgun txid ${singleCommitmentProofsData.railgunTxid}`,
  );

  // Submit and verify the proofs
  await SingleCommitmentProofManager.submitProof(
    networkName,
    txidVersion,
    singleCommitmentProofsData,
  );
};

export const getPOIsPerList = (
  chainType: string,
  chainID: string,
  params: GetPOIsPerListParams,
) => {
  const { txidVersion, listKeys, blindedCommitmentDatas } = params;

  const networkName = networkNameForSerializedChain(chainType, chainID);

  if (
    blindedCommitmentDatas.length >
    QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS
  ) {
    throw new Error(
      `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
    );
  }

  return POIMerkletreeManager.getPOIStatusPerList(
    listKeys,
    networkName,
    txidVersion,
    blindedCommitmentDatas,
  );
};

export const getPOIsPerBlindedCommitment = (
  chainType: string,
  chainID: string,
  params: GetPOIsPerBlindedCommitmentParams,
) => {
  const { txidVersion, listKey, blindedCommitmentDatas } = params;

  const networkName = networkNameForSerializedChain(chainType, chainID);

  if (
    blindedCommitmentDatas.length >
    QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS
  ) {
    throw new Error(
      `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
    );
  }

  return POIMerkletreeManager.poiStatusPerBlindedCommitment(
    listKey,
    networkName,
    txidVersion,
    blindedCommitmentDatas,
  );
};

export const getMerkleProofs = async (
  chainType: string,
  chainID: string,
  params: GetMerkleProofsParams,
) => {
  const { txidVersion, listKey, blindedCommitments } = params;

  const networkName = networkNameForSerializedChain(chainType, chainID);

  if (
    blindedCommitments.length >
    QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS
  ) {
    throw new Error(
      `Too many blinded commitments: max ${QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS}`,
    );
  }

  const merkleProofs = await POIMerkletreeManager.getMerkleProofs(
    listKey,
    networkName,
    txidVersion,
    blindedCommitments,
  );
  return merkleProofs;
};

export const getValidatedTxid = async (
  chainType: string,
  chainID: string,
  params: GetLatestValidatedRailgunTxidParams,
) => {
  const { txidVersion } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const validatedRailgunTxidStatus =
    await RailgunTxidMerkletreeManager.getValidatedRailgunTxidStatus(
      networkName,
      txidVersion,
    );
  return validatedRailgunTxidStatus;
};

export const validateTxidMerkleroot = async (
  chainType: string,
  chainID: string,
  params: ValidateTxidMerklerootParams,
) => {
  const { txidVersion, tree, index, merkleroot } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);

  const isValid = await RailgunTxidMerkletreeManager.checkIfMerklerootExists(
    networkName,
    txidVersion,
    tree,
    index,
    merkleroot,
  );
  return isValid;
};

export const validatePoiMerkleroots = async (
  chainType: string,
  chainID: string,
  params: ValidatePOIMerklerootsParams,
) => {
  const { txidVersion, listKey, poiMerkleroots } = params;
  const networkName = networkNameForSerializedChain(chainType, chainID);
  const isValid = await POIMerkletreeManager.validateAllPOIMerklerootsExist(
    txidVersion,
    networkName,
    listKey,
    poiMerkleroots,
  );
  return isValid;
};
