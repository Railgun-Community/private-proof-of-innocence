import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { LocalListProvider } from '../local-list-provider';
import supertest, { Response } from 'supertest';
import { expect } from 'chai';
import { SubmitShieldProofParams } from '../models/api-types';
import { SnarkProof, ShieldProofData } from '../models/proof-types';

describe('API', function () {
    let node: ProofOfInnocenceNode;
    let request: supertest.SuperTest<supertest.Test>;

    // Start services before all tests
    before(async function () {
        const listProvider = new LocalListProvider();

        const host = '0.0.0.0';
        const port = '3010';

        node = new ProofOfInnocenceNode(host, port, listProvider);
        await node.start();

        request = supertest(`http://${host}:${port}`);
    });

    // Stop services after all tests
    after(async function () {
        await node.stop();
    });

    it('Should return status ok for root route', async () => {
        const response: Response = await request.get('/');

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ status: 'ok' });
    });

    it('Should return performance metrics for /perf', async () => {
        const response = await request.get('/perf');

        expect(response.status).to.equal(200);
        expect(response.body).to.have.keys(['time', 'memoryUsage', 'freemem', 'loadavg']);
    });

    it('Should return node status for /node-status', async () => {
        // TODO: Make this type global
        type NodeStatusResponse = {
            Ethereum: {
                txidStatus: {
                    currentMerkleroot: string;
                    currentTxidIndex: number;
                    validatedMerkleroot?: string;
                    validatedTxidIndex?: number;
                };
            };
            Ethereum_Goerli: {
                txidStatus: {
                    currentMerkleroot: string;
                    currentTxidIndex: number;
                    validatedMerkleroot?: string;
                    validatedTxidIndex?: number;
                };
            };
        };


        const response: Response = await request.get('/node-status');
        const body = response.body as NodeStatusResponse;

        expect(response.status).to.equal(200);
        expect(body).to.have.keys(['Ethereum', 'Ethereum_Goerli']);
        expect(body.Ethereum).to.have.keys(['txidStatus']);
        expect(body.Ethereum.txidStatus).to.include.all.keys(['currentMerkleroot', 'currentTxidIndex']);
        expect(body.Ethereum_Goerli).to.have.keys(['txidStatus']);
        expect(body.Ethereum_Goerli.txidStatus).to.include.all.keys(['currentMerkleroot', 'currentTxidIndex']);
    });

    // it('Should handle POST /submit-shield-proof/:chainType/:chainID', async () => {
    //     // Mock data
    //     const chainType = 'Ethereum';
    //     const chainID = '1';

    //     const snarkProof: SnarkProof = {
    //         pi_a: ['123', '456'],
    //         pi_b: [['789', '012'], ['345', '678']],
    //         pi_c: ['901', '234']
    //     };

    //     const shieldProofData: ShieldProofData = {
    //         snarkProof,
    //         commitmentHash: 'mockCommitmentHash',
    //         blindedCommitment: 'mockBlindedCommitment'
    //     };

    //     const submitShieldProofParams: SubmitShieldProofParams = {
    //         shieldProofData
    //     };

    //     // Send request and receive response
    //     const response: Response = await request
    //         .post(`/submit-shield-proof/${chainType}/${chainID}`)
    //         .send(submitShieldProofParams);

    //     // Assertions
    //     expect(response.status).to.equal(200);
    //     // ... any other checks
    // });
});
