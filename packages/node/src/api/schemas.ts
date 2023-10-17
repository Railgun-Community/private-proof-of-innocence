import { AllowedSchema } from 'express-json-validator-middleware';
import { JSONSchema4 } from 'json-schema';

// SHARED SCHEMA FOR MANY REQUESTS:
export const SharedChainTypeIDParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
  },
  required: ['chainType', 'chainID'],
};

export const GetPOIListEventRangeBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    startIndex: { type: 'number' },
    endIndex: { type: 'number' },
    listKey: { type: 'string' },
  },
  required: ['txidVersion', 'startIndex', 'endIndex', 'listKey'],
};

export const GetTransactProofsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    bloomFilterSerialized: { type: 'string' },
    listKey: { type: 'string' },
  },
  required: ['txidVersion', 'bloomFilterSerialized', 'listKey'],
};

export const GetLegacyTransactProofsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    bloomFilterSerialized: { type: 'string' },
  },
  required: ['txidVersion', 'bloomFilterSerialized'],
};

export const GetBlockedShieldsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    listKey: { type: 'string' },
    txidVersion: { type: 'string' },
    bloomFilterSerialized: { type: 'string' },
  },
  required: ['txidVersion', 'bloomFilterSerialized', 'listKey'],
};

const SnarkProofSchema: JSONSchema4 = {
  type: 'object',
  properties: {
    pi_a: {
      type: 'array',
      items: [{ type: 'string' }, { type: 'string' }],
      minItems: 2,
      maxItems: 2,
    },
    pi_b: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 2,
      },
      minItems: 2,
      maxItems: 2,
    },
    pi_c: {
      type: 'array',
      items: [{ type: 'string' }, { type: 'string' }],
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['pi_a', 'pi_b', 'pi_c'],
};

export const SubmitTransactProofBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    listKey: { type: 'string' },
    transactProofData: {
      type: 'object',
      properties: {
        snarkProof: SnarkProofSchema,
        poiMerkleroots: { type: 'array', items: { type: 'string' } },
        txidMerkleroot: { type: 'string' },
        txidMerklerootIndex: { type: 'number' },
        blindedCommitmentsOut: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'snarkProof',
        'poiMerkleroots',
        'txidMerkleroot',
        'txidMerklerootIndex',
        'blindedCommitmentsOut',
      ],
    },
  },
  required: ['txidVersion', 'listKey', 'transactProofData'],
};

export const SubmitLegacyTransactProofsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    listKeys: { type: 'array', items: { type: 'string' } },
    legacyTransactProofDatas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          txidIndex: { type: 'string' },
          npk: { type: 'string' },
          value: { type: 'string' },
          tokenHash: { type: 'string' },
          blindedCommitment: { type: 'string' },
        },
        required: [
          'txidIndex',
          'npk',
          'value',
          'tokenHash',
          'blindedCommitment',
        ],
      },
    },
  },
  required: ['txidVersion'],
};

export const RemoveTransactProofBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    listKey: { type: 'string' },
    blindedCommitmentsOut: { type: 'array', items: { type: 'string' } },
    railgunTxidIfHasUnshield: { type: 'string' },
    signature: { type: 'string' },
  },
  required: [
    'txidVersion',
    'listKey',
    'blindedCommitmentsOut',
    'railgunTxidIfHasUnshield',
    'signature',
  ],
};

export const SubmitPOIEventBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    listKey: { type: 'string' },
    signedPOIEvent: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        blindedCommitment: { type: 'string' },
        signature: { type: 'string' },
        type: { type: 'string' },
      },
      required: ['index', 'blindedCommitment', 'signature', 'type'],
    },
  },
  required: ['txidVersion', 'listKey', 'signedPOIEvent'],
};

export const SubmitValidatedTxidBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    txidIndex: { type: 'number' },
    merkleroot: { type: 'string' },
    signature: { type: 'string' },
    listKey: { type: 'string' },
  },
  required: ['txidVersion', 'txidIndex', 'merkleroot', 'signature', 'listKey'],
};

export const GetPOIsPerListBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    listKeys: {
      type: 'array',
      items: { type: 'string' },
    },
    blindedCommitmentDatas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          blindedCommitment: { type: 'string' },
          type: {
            type: 'string',
            enum: ['Shield', 'Transact'],
          },
        },
        required: ['blindedCommitment', 'type'],
      },
    },
  },
  required: ['txidVersion', 'listKeys', 'blindedCommitmentDatas'],
};

export const GetMerkleProofsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    listKey: { type: 'string' },
    blindedCommitments: { type: 'array', items: { type: 'string' } },
  },
  required: ['txidVersion', 'listKey', 'blindedCommitments'],
};

export const GetLatestValidatedRailgunTxidBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
  },
  required: ['txidVersion'],
};

export const ValidateTxidMerklerootBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    txidVersion: { type: 'string' },
    tree: { type: 'number' },
    index: { type: 'number' },
    merkleroot: { type: 'string' },
  },
  required: ['txidVersion', 'tree', 'index', 'merkleroot'],
};
