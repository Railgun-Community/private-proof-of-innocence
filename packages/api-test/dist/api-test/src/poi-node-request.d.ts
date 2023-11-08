import { NetworkName, TransactProofData, NodeStatusAllNetworks, TXIDVersion, LegacyTransactProofData, SingleCommitmentProofsData, MerkleProof, BlindedCommitmentData } from '@railgun-community/shared-models';
import { POISyncedListEvent, POIsPerBlindedCommitmentMap, SignedBlockedShield, SignedPOIEvent } from '../../node/src/models/poi-types';
export declare class POINodeRequest {
    private static getNodeRouteURL;
    private static getRequest;
    private static postRequest;
    static validateRailgunTxidMerkleroot: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, tree: number, index: number, merkleroot: string) => Promise<boolean>;
    static getNodeStatusAllNetworks: (nodeURL: string) => Promise<NodeStatusAllNetworks>;
    static getPOIListEventRange: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, startIndex: number, endIndex: number) => Promise<POISyncedListEvent[]>;
    static getFilteredTransactProofs: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, bloomFilterSerialized: string) => Promise<TransactProofData[]>;
    static getFilteredLegacyTransactProofs: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, bloomFilterSerialized: string) => Promise<LegacyTransactProofData[]>;
    static getFilteredBlockedShields: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, bloomFilterSerialized: string) => Promise<SignedBlockedShield[]>;
    static submitTransactProof: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, transactProofData: TransactProofData) => Promise<void>;
    static submitLegacyTransactProof: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, legacyTransactProofData: LegacyTransactProofData) => Promise<void>;
    static submitSingleCommitmentProof: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, singleCommitmentProofsData: SingleCommitmentProofsData) => Promise<void>;
    static submitPOIEvent: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, signedPOIEvent: SignedPOIEvent, validatedMerkleroot: string) => Promise<void>;
    static getMerkleProofs: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, blindedCommitments: string[]) => Promise<MerkleProof[]>;
    static getPOIStatusPerBlindedCommitment: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, blindedCommitmentDatas: BlindedCommitmentData[]) => Promise<POIsPerBlindedCommitmentMap>;
    static validatePOIMerkleroots: (nodeURL: string, networkName: NetworkName, txidVersion: TXIDVersion, listKey: string, poiMerkleroots: string[]) => Promise<boolean>;
}
