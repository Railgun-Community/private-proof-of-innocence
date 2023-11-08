"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POINodeRequest = void 0;
const shared_models_1 = require("@railgun-community/shared-models");
const axios_1 = __importStar(require("axios"));
const debug_1 = __importDefault(require("debug"));
const dbg = (0, debug_1.default)('poi:request');
class POINodeRequest {
    static getNodeRouteURL = (url, route) => {
        return `${url}/${route}`;
    };
    static async getRequest(url) {
        try {
            const { data } = await axios_1.default.get(url);
            return data;
        }
        catch (err) {
            if (!(err instanceof axios_1.AxiosError)) {
                throw err;
            }
            const errMessage = err.message;
            dbg(`ERROR ${url} - ${errMessage}`);
            throw new Error(errMessage);
        }
    }
    static async postRequest(url, params) {
        try {
            const { data } = await axios_1.default.post(url, params);
            return data;
        }
        catch (err) {
            if (!(err instanceof axios_1.AxiosError)) {
                throw err;
            }
            const errMessage = `${err.message}: ${err.response?.data}`;
            dbg(`ERROR ${url} - ${errMessage}`);
            throw new Error(errMessage);
        }
    }
    static validateRailgunTxidMerkleroot = async (nodeURL, networkName, txidVersion, tree, index, merkleroot) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `validate-txid-merkleroot/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const isValid = await POINodeRequest.postRequest(url, {
            txidVersion,
            tree,
            index,
            merkleroot,
        });
        return isValid;
    };
    static getNodeStatusAllNetworks = async (nodeURL) => {
        const route = `node-status-v2`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const nodeStatusAllNetworks = await POINodeRequest.getRequest(url);
        return nodeStatusAllNetworks;
    };
    static getPOIListEventRange = async (nodeURL, networkName, txidVersion, listKey, startIndex, endIndex) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `poi-events/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const poiEvents = await POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            startIndex,
            endIndex,
        });
        return poiEvents;
    };
    static getPOIMerkletreeLeaves = async (nodeURL, networkName, txidVersion, listKey, startIndex, endIndex) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `poi-merkletree-leaves/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const poiMerkletreeLeaves = await POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            startIndex,
            endIndex,
        });
        return poiMerkletreeLeaves;
    };
    static getFilteredTransactProofs = async (nodeURL, networkName, txidVersion, listKey, bloomFilterSerialized) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `transact-proofs/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const transactProofs = await POINodeRequest.postRequest(url, {
            listKey,
            txidVersion,
            bloomFilterSerialized,
        });
        return transactProofs;
    };
    static getFilteredLegacyTransactProofs = async (nodeURL, networkName, txidVersion, bloomFilterSerialized) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `legacy-transact-proofs/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const transactProofs = await POINodeRequest.postRequest(url, {
            txidVersion,
            bloomFilterSerialized,
        });
        return transactProofs;
    };
    static getFilteredBlockedShields = async (nodeURL, networkName, txidVersion, listKey, bloomFilterSerialized) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `blocked-shields/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        const signedBlockedShields = await POINodeRequest.postRequest(url, {
            listKey,
            txidVersion,
            bloomFilterSerialized,
        });
        return signedBlockedShields;
    };
    static submitTransactProof = async (nodeURL, networkName, txidVersion, listKey, transactProofData) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `submit-transact-proof/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        await POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            transactProofData,
        });
    };
    static submitLegacyTransactProof = async (nodeURL, networkName, txidVersion, legacyTransactProofData) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `submit-legacy-transact-proofs/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        await POINodeRequest.postRequest(url, {
            txidVersion,
            listKeys: [],
            legacyTransactProofDatas: [legacyTransactProofData],
        });
    };
    static submitSingleCommitmentProof = async (nodeURL, networkName, txidVersion, singleCommitmentProofsData) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `submit-single-commitment-proofs/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        await POINodeRequest.postRequest(url, {
            txidVersion,
            singleCommitmentProofsData,
        });
    };
    static submitPOIEvent = async (nodeURL, networkName, txidVersion, listKey, signedPOIEvent, validatedMerkleroot) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `submit-poi-event/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        await POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            signedPOIEvent,
            validatedMerkleroot,
        });
    };
    static getMerkleProofs = async (nodeURL, networkName, txidVersion, listKey, blindedCommitments) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `merkle-proofs/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        return POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            blindedCommitments,
        });
    };
    static getPOIStatusPerBlindedCommitment = async (nodeURL, networkName, txidVersion, listKey, blindedCommitmentDatas) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `pois-per-blinded-commitment/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        return POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            blindedCommitmentDatas,
        });
    };
    static validatePOIMerkleroots = async (nodeURL, networkName, txidVersion, listKey, poiMerkleroots) => {
        const chain = shared_models_1.NETWORK_CONFIG[networkName].chain;
        const route = `validate-poi-merkleroots/${chain.type}/${chain.id}`;
        const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
        return POINodeRequest.postRequest(url, {
            txidVersion,
            listKey,
            poiMerkleroots,
        });
    };
}
exports.POINodeRequest = POINodeRequest;
//# sourceMappingURL=api-test-poi-node-request.js.map