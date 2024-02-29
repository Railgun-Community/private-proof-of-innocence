/**
 * JSON RPC Handler Utilities
 *
 * @see Routes requiring a schema add chainID and chainType to the params.
 * The shared schemas don't include them for REST API, since they are in the URL for REST.
 * For JSON RPC, they are in the body, so we need to add them to the params until REST is deprecated.
 */

import { Response } from 'express';
import {
  AllowedSchema,
  ValidationError,
} from 'express-json-validator-middleware';
import {
  GetLegacyTransactProofsParams,
  GetPOIListEventRangeParams,
  GetPOIMerkletreeLeavesParams,
  GetPOIsPerBlindedCommitmentParams,
  RemoveTransactProofParams,
  SubmitPOIEventParams,
  SubmitValidatedTxidAndMerklerootParams,
} from 'models/poi-types';
import {
  getNodeStatusListKey,
  getNodeStatus_ROUTE,
  getPoiEvents,
  getPOIMerkletreeLeaves,
  getTransactProofs,
  getLegacyTransactProofs,
  getBlockedShields,
  submitPOIEvent,
  submitValidatedTxid,
  removeTransactProof,
  submitTransactProof,
  submitLegacyTransactProofs,
  submitSingleCommitmentProofs,
  getPOIsPerList,
  getPOIsPerBlindedCommitment,
  getMerkleProofs,
  getValidatedTxid,
  validateTxidMerkleroot,
  validatePoiMerkleroots,
} from './route-logic';
import {
  ExtendedGetPOIListEventRangeBodySchema,
  GetBlockedShieldsBodySchema,
  GetLatestValidatedRailgunTxidBodySchema,
  GetLegacyTransactProofsBodySchema,
  GetMerkleProofsBodySchema,
  GetPOIMerkletreeLeavesBodySchema,
  GetPOIsPerBlindedCommitmentBodySchema,
  GetPOIsPerListBodySchema,
  GetTransactProofsBodySchema,
  RemoveTransactProofBodySchema,
  SubmitLegacyTransactProofsBodySchema,
  SubmitSingleCommitmentProofsBodySchema,
  SubmitTransactProofBodySchema,
  SubmitValidatedTxidBodySchema,
  ValidatePOIMerklerootsBodySchema,
  ValidateTxidMerklerootBodySchema,
} from './schemas';
import {
  GetBlockedShieldsParams,
  GetLatestValidatedRailgunTxidParams,
  GetMerkleProofsParams,
  GetPOIsPerListParams,
  GetTransactProofsParams,
  SubmitLegacyTransactProofParams,
  SubmitSingleCommitmentProofsParams,
  SubmitTransactProofParams,
  ValidatePOIMerklerootsParams,
  ValidateTxidMerklerootParams,
  isDefined,
} from '@railgun-community/shared-models';
import { JsonRpcError } from 'ethers';

export type LogicFunction = (params?: any) => Promise<any>;
export type Schema = AllowedSchema | null;
export type LogicFunctionMap = {
  [key: string]: {
    logicFunction: LogicFunction;
    schema: Schema;
  };
};

/**
 * Handle JSON RPC errors
 *
 * @param res - Express response
 * @param error - Error to handle
 * @param id - JSON RPC request id
 */
export const handleJsonRpcError = (res: Response, error: Error, id: string) => {
  res.status(500).json({
    jsonrpc: '2.0',
    error: { code: -32603, message: error.message },
    id,
  });
};

export function formatJsonRpcError(error: ValidationError): JsonRpcError {
  // Format the validation error for JSON-RPC response
  const errorDetails = error.validationErrors.body ?? [];
  return {
    id: Date.now(),
    error: { code: -32602, message: 'Invalid params', data: errorDetails },
  };
}

/**
 * Get the logic function map for the JSON RPC handler
 *
 * @param params - JSON RPC params
 * @param listKeys - List keys from the API class
 * @param dbg - Debug object for logging when needed
 * @returns Logic function map
 */
export const getLogicFunctionMap = (
  params: any,
  listKeys: any[],
  dbg: debug.Debugger,
): LogicFunctionMap => {
  return {
    // *** Aggregator methods
    ppoi_node_status: {
      logicFunction: async () => {
        return isDefined(params.listKey)
          ? getNodeStatusListKey(params.listKey)
          : getNodeStatus_ROUTE(listKeys);
      },
      schema: null,
    },
    ppoi_poi_events: {
      logicFunction: () =>
        getPoiEvents(
          params.chainType,
          params.chainID,
          params as GetPOIListEventRangeParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: ExtendedGetPOIListEventRangeBodySchema,
    },
    ppoi_poi_merkletree_leaves: {
      logicFunction: () =>
        getPOIMerkletreeLeaves(
          params.chainType,
          params.chainID,
          params as GetPOIMerkletreeLeavesParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetPOIMerkletreeLeavesBodySchema,
    },
    ppoi_transact_proofs: {
      logicFunction: async () =>
        getTransactProofs(
          params.chainType,
          params.chainID,
          params as GetTransactProofsParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetTransactProofsBodySchema,
    },
    ppoi_legacy_transact_proofs: {
      logicFunction: async () =>
        getLegacyTransactProofs(
          params.chainType,
          params.chainID,
          params as GetLegacyTransactProofsParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetLegacyTransactProofsBodySchema,
    },
    ppoi_blocked_shields: {
      logicFunction: async () =>
        getBlockedShields(
          params.chainType,
          params.chainID,
          params as GetBlockedShieldsParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetBlockedShieldsBodySchema,
    },
    ppoi_submit_poi_events: {
      logicFunction: () =>
        submitPOIEvent(
          params.chainType,
          params.chainID,
          params as SubmitPOIEventParams & {
            chainType: string;
            chainID: string;
          },
          dbg,
        ),
      schema: null,
    },
    ppoi_submit_validated_txid: {
      logicFunction: () =>
        submitValidatedTxid(
          params.chainType,
          params.chainID,
          params as SubmitValidatedTxidAndMerklerootParams & {
            chainType: string;
            chainID: string;
          },
          dbg,
        ),
      schema: SubmitValidatedTxidBodySchema,
    },
    ppoi_remove_transact_proof: {
      logicFunction: () =>
        removeTransactProof(
          params.chainType,
          params.chainID,
          params as RemoveTransactProofParams & {
            chainType: string;
            chainID: string;
          },
          dbg,
        ),
      schema: RemoveTransactProofBodySchema,
    },
    // *** Client methods
    ppoi_submit_transact_proof: {
      logicFunction: () =>
        submitTransactProof(
          params.chainType,
          params.chainID,
          params as SubmitTransactProofParams & {
            chainType: string;
            chainID: string;
          },
          dbg,
        ),
      schema: SubmitTransactProofBodySchema,
    },
    ppoi_submit_legacy_transact_proofs: {
      logicFunction: () =>
        submitLegacyTransactProofs(
          params.chainType,
          params.chainID,
          params as SubmitLegacyTransactProofParams & {
            chainType: string;
            chainID: string;
          },
          dbg,
        ),
      schema: SubmitLegacyTransactProofsBodySchema,
    },
    ppoi_submit_single_commitment_proofs: {
      logicFunction: () =>
        submitSingleCommitmentProofs(
          params.chainType,
          params.chainID,
          params as SubmitSingleCommitmentProofsParams & {
            chainType: string;
            chainID: string;
          },
          dbg,
        ),
      schema: SubmitSingleCommitmentProofsBodySchema,
    },
    ppoi_pois_per_list: {
      logicFunction: () =>
        getPOIsPerList(
          params.chainType,
          params.chainID,
          params as GetPOIsPerListParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetPOIsPerListBodySchema,
    },
    ppoi_pois_per_blinded_commitment: {
      logicFunction: () =>
        getPOIsPerBlindedCommitment(
          params.chainType,
          params.chainID,
          params as GetPOIsPerBlindedCommitmentParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetPOIsPerBlindedCommitmentBodySchema,
    },
    ppoi_merkle_proofs: {
      logicFunction: () =>
        getMerkleProofs(
          params.chainType,
          params.chainID,
          params as GetMerkleProofsParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetMerkleProofsBodySchema,
    },
    ppoi_validated_txid: {
      logicFunction: () =>
        getValidatedTxid(
          params.chainType,
          params.chainID,
          params as GetLatestValidatedRailgunTxidParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: GetLatestValidatedRailgunTxidBodySchema,
    },
    ppoi_validate_txid_merkleroot: {
      logicFunction: () =>
        validateTxidMerkleroot(
          params.chainType,
          params.chainID,
          params as ValidateTxidMerklerootParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: ValidateTxidMerklerootBodySchema,
    },
    ppoi_validate_poi_merkleroots: {
      logicFunction: () =>
        validatePoiMerkleroots(
          params.chainType,
          params.chainID,
          params as ValidatePOIMerklerootsParams & {
            chainType: string;
            chainID: string;
          },
        ),
      schema: ValidatePOIMerklerootsBodySchema,
    },
  };
};
