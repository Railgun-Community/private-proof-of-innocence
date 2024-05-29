# Node-to-Node Communication API

This document provides the specifications for the node-to-node communication API used in Private Proofs of Innocence.

## Overview

The application exposes two types of endpoints for node-to-node communication:

1. **REST**
2. **JSON-RPC**

### Definitions

1. **listKey**: Each PPOI node has a public identifier (key).
2. **txidVersion**: Cuurently there is only the `V2_PoseidonMerkle` txidVersion. The launch of RAILGUN v3 will bring `V3_PoseidonMerkle`.
3. **chainType**: The type of blockchain, for example `ChainType.EVM` from [shared-models](https://github.com/Railgun-Community/shared-models/blob/main/src/models/network-config.ts).
4. **chainID**: The ID of the blockchain, for example `1` for Ethereum from [shared-models](https://github.com/Railgun-Community/shared-models/blob/main/src/models/network-config.ts).

## REST Endpoints

### Status Routes

#### Get Status

- **Endpoint**: `/`
- **Method**: `GET`
- **Response**:
  - Status: 200 OK
  - Body: `ok`

#### Get Performance

- **Endpoint**: `/perf`
- **Method**: `GET` (protected by authentication)
- **Response**:
  - Status: 200 OK
  - Body: Object containing time, memoryUsage, freemem, and loadavg.

### Aggregator Routes

#### Get Node Status for All Networks

- **Endpoint**: `/node-status-v2`
- **Method**: `GET`
- **Response**:
  - Status: 200 OK
  - Body: `NodeStatusAllNetworks` object with the status of nodes across all networks.

#### Get Node Status for Specific List Key

- **Endpoint**: `/node-status-v2/:listKey`
- **Method**: `GET`
- **Parameters**:
  - `listKey` (path)
- **Response**:
  - Status: 200 OK
  - Body: `NodeStatusAllNetworks` object with the status of nodes for the specified list key.

#### Get POI Events

- **Endpoint**: `/poi-events/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `startIndex` (number) - The start index of the events.
  - `endIndex` (number) - The end index of the events.
- **Response**:
  - Status: 200 OK
  - Body: Array of `POISyncedListEvent` objects.

#### Get POI Merkle Tree Leaves

- **Endpoint**: `/poi-merkletree-leaves/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `startIndex` (number) - The start index of the leaves.
  - `endIndex` (number) - The end index of the leaves.
- **Response**:
  - Status: 200 OK
  - Body: Array of strings representing Merkle tree leaves.

#### Get Transact Proofs

- **Endpoint**: `/transact-proofs/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `bloomFilterSerialized` (string) - Serialized bloom filter data.
- **Response**:
  - Status: 200 OK
  - Body: Array of `TransactProofData` objects.

#### Get Legacy Transact Proofs

- **Endpoint**: `/legacy-transact-proofs/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `bloomFilterSerialized` (string) - Serialized bloom filter data.
- **Response**:
  - Status: 200 OK
  - Body: Array of `LegacyTransactProofData` objects.

#### Get Blocked Shields

- **Endpoint**: `/blocked-shields/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `bloomFilterSerialized` (string) - Serialized bloom filter data.
- **Response**:
  - Status: 200 OK
  - Body: Array of `SignedBlockedShield` objects.

#### Submit Validated TXID

- **Endpoint**: `/submit-validated-txid/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `txidIndex` (number) - The index of the TXID.
  - `merkleroot` (string) - The Merkle root.
  - `signature` (string) - The signature.
- **Response**:
  - Status: 200 OK

#### Remove Transact Proof

- **Endpoint**: `/remove-transact-proof/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `blindedCommitmentsOut` (array of strings) - The blinded commitments out.
  - `railgunTxidIfHasUnshield` (string, optional) - The railgun TXID if it has an unshield.
  - `signature` (string) - The signature.
- **Response**:
  - Status: 200 OK

### Client Routes

#### Submit Transact Proof

- **Endpoint**: `/submit-transact-proof/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `transactProofData` (object) - The transact proof data.
- **Response**:
  - Status: 200 OK

#### Submit Legacy Transact Proofs

- **Endpoint**: `/submit-legacy-transact-proofs/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKeys` (array of strings) - The list keys.
  - `legacyTransactProofDatas` (array of objects) - The legacy transact proof data.
- **Response**:
  - Status: 200 OK

#### Submit Single Commitment Proofs

- **Endpoint**: `/submit-single-commitment-proofs/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `singleCommitmentProofsData` (object) - The single commitment proofs data.
- **Response**:
  - Status: 200 OK

#### Get POIs Per List

- **Endpoint**: `/pois-per-list/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKeys` (array of strings) - The list keys.
  - `blindedCommitmentDatas` (array of objects) - The blinded commitment data.
- **Response**:
  - Status: 200 OK
  - Body: `POIsPerListMap` object.

#### Get POIs Per Blinded Commitment

- **Endpoint**: `/pois-per-blinded-commitment/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `blindedCommitmentDatas` (array of objects) - The blinded commitment data.
- **Response**:
  - Status: 200 OK
  - Body: `POIsPerBlindedCommitmentMap` object.

#### Get Merkle Proofs

- **Endpoint**: `/merkle-proofs/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `blindedCommitments` (array of strings) - The blinded commitments.
- **Response**:
  - Status: 200 OK
  - Body: Array of `MerkleProof` objects.

#### Get Validated TXID

- **Endpoint**: `/validated-txid/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
- **Response**:
  - Status: 200 OK
  - Body: `ValidatedRailgunTxidStatus` object.

#### Validate TXID Merkle Root

- **Endpoint**: `/validate-txid-merkleroot/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `tree` (string) - The tree identifier.
  - `index` (number) - The index in the tree.
  - `merkleroot` (string) - The Merkle root.
- **Response**:
  - Status: 200 OK
  - Body: boolean indicating validation result.

#### Validate POI Merkle Roots

- **Endpoint**: `/validate-poi-merkleroots/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `poiMerkleroots` (array of strings) - The POI Merkle roots.
- **Response**:
  - Status: 200 OK
  - Body: boolean indicating validation result.

#### Submit POI Event

- **Endpoint**: `/submit-poi-event/:chainType/:chainID`
- **Method**: `POST`
- **Parameters**:
  - `chainType` (path)
  - `chainID` (path)
- **Request Body**:
  - `txidVersion` (string)
  - `listKey` (string)
  - `signedPOIEvent` (object) - The signed POI event data.
  - `validatedMerkleroot` (string) - The validated Merkle root.
- **Response**:
  - Status: 200 OK

## JSON-RPC Endpoints

### Aggregator Routes

#### Method: `ppoi_node_status`

- **Parameters**:
  - `listKey` (optional) - The key to identify the list.
- **Response**:
  - Status: 200 OK
  - Body: `NodeStatusAllNetworks` object.

#### Method: `ppoi_poi_events`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `listKey` (string)
  - `txidVersion` (string)
  - `startIndex` (number) - The start index of the events.
  - `endIndex` (number) - The end index of the events.
- **Response**:
  - Status: 200 OK
  - Body: Array of `POISyncedListEvent` objects.

#### Method: `ppoi_poi_merkletree_leaves`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `listKey` (string)
  - `txidVersion` (string)
  - `startIndex` (number) - The start index of the leaves.
  - `endIndex` (number) - The end index of the leaves.
- **Response**:
  - Status: 200 OK
  - Body: Array of strings representing Merkle tree leaves.

#### Method: `ppoi_transact_proofs`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `listKey` (string)
  - `txidVersion` (string)
  - `bloomFilterSerialized` (string) - Serialized bloom filter data.
- **Response**:
  - Status: 200 OK
  - Body: Array of `TransactProofData` objects.

#### Method: `ppoi_legacy_transact_proofs`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `bloomFilterSerialized` (string) - Serialized bloom filter data.
- **Response**:
  - Status: 200 OK
  - Body: Array of `LegacyTransactProofData` objects.

#### Method: `ppoi_blocked_shields`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `bloomFilterSerialized` (string) - Serialized bloom filter data.
- **Response**:
  - Status: 200 OK
  - Body: Array of `SignedBlockedShield` objects.

#### Method: `ppoi_submit_poi_events`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `signedPOIEvent` (object) - The signed POI event data.
  - `validatedMerkleroot` (string) - The validated Merkle root.
- **Response**:
  - Status: 200 OK

#### Method: `ppoi_submit_validated_txid`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `txidIndex` (number) - The index of the TXID.
  - `merkleroot` (string) - The Merkle root.
  - `signature` (string) - The signature.
- **Response**:
  - Status: 200 OK

#### Method: `ppoi_remove_transact_proof`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `blindedCommitmentsOut` (array of strings) - The blinded commitments out.
  - `railgunTxidIfHasUnshield` (string, optional) - The railgun TXID if it has an unshield.
  - `signature` (string) - The signature.
- **Response**:
  - Status: 200 OK

### Cient Routes

#### Method: `ppoi_submit_transact_proof`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `transactProofData` (object) - The transact proof data.
- **Response**:
  - Status: 200 OK

#### Method: `ppoi_submit_legacy_transact_proofs`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKeys` (array of strings) - The list keys.
  - `legacyTransactProofDatas` (array of objects) - The legacy transact proof data.
- **Response**:
  - Status: 200 OK

#### Method: `ppoi_submit_single_commitment_proofs`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `singleCommitmentProofsData` (object) - The single commitment proofs data.
- **Response**:
  - Status: 200 OK

#### Method: `ppoi_pois_per_list`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKeys` (array of strings) - The list keys.
  - `blindedCommitmentDatas` (array of objects) - The blinded commitment data.
- **Response**:
  - Status: 200 OK
  - Body: `POIsPerListMap` object.

#### Method: `ppoi_pois_per_blinded_commitment`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `blindedCommitmentDatas` (array of objects) - The blinded commitment data.
- **Response**:
  - Status: 200 OK
  - Body: `POIsPerBlindedCommitmentMap` object.

#### Method: `ppoi_merkle_proofs`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `blindedCommitments` (array of strings) - The blinded commitments.
- **Response**:
  - Status: 200 OK
  - Body: Array of `MerkleProof` objects.

#### Method: `ppoi_validated_txid`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
- **Response**:
  - Status: 200 OK
  - Body: `ValidatedRailgunTxidStatus` object.

#### Method: `ppoi_validate_txid_merkleroot`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `tree` (number)
  - `index` (number)
  - `merkleroot` (string)
- **Response**:
  - Status: 200 OK
  - Body: `isValid` boolean.

#### Method: `ppoi_validate_poi_merkleroots`

- **Parameters**:
  - `chainType` (string)
  - `chainID` (number)
  - `txidVersion` (string)
  - `listKey` (string)
  - `poiMerkleRoots` (string[])
- **Response**:
  - Status: 200 OK
  - Body: `isValid` boolean.
