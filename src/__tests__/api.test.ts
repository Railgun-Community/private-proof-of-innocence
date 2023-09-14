import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { LocalListProvider } from '../local-list-provider';
import supertest, { Response } from 'supertest';
import { expect } from 'chai';
import { NodeStatusAllNetworks } from '../models/api-types';

describe('API', function () {
    let node: ProofOfInnocenceNode;
    let request: supertest.SuperTest<supertest.Test>;

    // Start services before all tests
    before(async function () {
        const listProvider = new LocalListProvider();

        const host = '0.0.0.0';
        const port = '3010';
        const connectedNodeURLs = ['http://localhost:3000'];

        node = new ProofOfInnocenceNode(host, port, connectedNodeURLs, listProvider);
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
        const response: Response = await request.get('/node-status');
        const body = response.body as NodeStatusAllNetworks;

        expect(response.status).to.equal(200);
        expect(body).to.have.keys(['listKeys', 'forNetwork']);
        expect(body.forNetwork).to.have.keys(['Ethereum', 'Ethereum_Goerli']);
        expect(body.forNetwork.Ethereum).to.have.keys(['txidStatus', 'eventListStatuses']);

        if (body.forNetwork.Ethereum) {
            expect(body.forNetwork.Ethereum.txidStatus).to.have.all.keys(['currentTxidIndex', 'currentMerkleroot', 'validatedTxidIndex', 'validatedMerkleroot']);
        }

        if (body.forNetwork.Ethereum_Goerli) {
            expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.have.all.keys(['currentTxidIndex', 'currentMerkleroot', 'validatedTxidIndex', 'validatedMerkleroot']);
        }
    });
});
