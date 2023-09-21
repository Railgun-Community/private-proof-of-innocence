import { AllowedSchema } from 'express-json-validator-middleware';

export const GetTransactProofsParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
    listKey: { type: 'string' },
  },
  required: ['chainType', 'chainID', 'listKey'],
};

export const GetTransactProofsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    bloomFilterSerialized: { type: 'string' },
  },
  required: ['bloomFilterSerialized'],
};

export const GetBlockedShieldsParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
    listKey: { type: 'string' },
  },
  required: ['chainType', 'chainID', 'listKey'],
};

export const GetBlockedShieldsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    bloomFilterSerialized: { type: 'string' },
  },
  required: ['bloomFilterSerialized'],
};

export const SubmitTransactProofParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
  },
  required: ['chainType', 'chainID'],
};

export const SubmitTransactProofBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    listKey: { type: 'string' },
    transactProofData: {
      type: 'object',
      properties: {
        snarkProof: {
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
        },
        poiMerkleroots: { type: 'array', items: { type: 'string' } },
        txidMerkleroot: { type: 'string' },
        txidMerklerootIndex: { type: 'number' },
        blindedCommitmentOutputs: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'snarkProof',
        'poiMerkleroots',
        'txidMerkleroot',
        'txidMerklerootIndex',
        'blindedCommitmentOutputs',
      ],
    },
  },
  required: ['listKey', 'transactProofData'],
};

export const GetPOIsPerListParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
  },
  required: ['chainType', 'chainID'],
};

export const GetPOIsPerListBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
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
  required: ['listKeys', 'blindedCommitmentDatas'],
};

export const GetMerkleProofsParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
  },
  required: ['chainType', 'chainID'],
};

export const GetMerkleProofsBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    listKey: { type: 'string' },
    blindedCommitments: { type: 'array', items: { type: 'string' } },
  },
  required: ['listKey', 'blindedCommitments'],
};

export const ValidateTxidMerklerootParamsSchema: AllowedSchema = {
  type: 'object',
  properties: {
    chainType: { type: 'string' },
    chainID: { type: 'string' },
  },
  required: ['chainType', 'chainID'],
};

export const ValidateTxidMerklerootBodySchema: AllowedSchema = {
  type: 'object',
  properties: {
    tree: { type: 'number' },
    index: { type: 'number' },
    merkleroot: { type: 'string' },
  },
  required: ['tree', 'index', 'merkleroot'],
};
