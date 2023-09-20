import { ProofOfInnocenceNode } from "../proof-of-innocence-node";
import { LocalListProvider } from "../local-list-provider";
import supertest, { Response } from "supertest";
import { expect } from "chai";
import { MOCK_LIST_KEYS } from "../tests/mocks.test";
import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  NodeStatusAllNetworks,
  TransactProofData,
} from "@railgun-community/shared-models";

const listKey = MOCK_LIST_KEYS[0];

describe("api", function () {
  let node3010: ProofOfInnocenceNode;
  let node3011: ProofOfInnocenceNode;
  let request: supertest.SuperTest<supertest.Test>;

  // Start services before all tests
  before(async function () {
    this.timeout(30000);

    const listProvider = new LocalListProvider(listKey);

    const host = "0.0.0.0";

    node3011 = new ProofOfInnocenceNode(host, "3011", [], listProvider);
    await node3011.start();

    node3010 = new ProofOfInnocenceNode(
      host,
      "3010",
      ["http://localhost:3011"],
      listProvider
    );
    await node3010.start();

    request = supertest(`http://${host}:3010`);
  });

  after(async function () {
    await node3010.stop();
    await node3011.stop();
  });

  it("Should return status ok for GET /", async () => {
    const response: Response = await request.get("/");

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: "ok" });
  });

  it("Should return performance metrics for GET /perf", async () => {
    const response = await request.get("/perf");

    expect(response.status).to.equal(200);
    expect(response.body).to.have.keys([
      "time",
      "memoryUsage",
      "freemem",
      "loadavg",
    ]);
  });

  it("Should return node status for GET /node-status", async () => {
    const response: Response = await request.get("/node-status");
    const body = response.body as NodeStatusAllNetworks;

    expect(response.status).to.equal(200);
    expect(body).to.have.keys(["listKeys", "forNetwork"]);
    expect(body.forNetwork).to.have.keys(["Ethereum", "Ethereum_Goerli"]);
    expect(body.forNetwork.Ethereum).to.have.keys([
      "txidStatus",
      "listStatuses",
      "shieldQueueStatus",
    ]);

    if (body.forNetwork.Ethereum) {
      expect(body.forNetwork.Ethereum.txidStatus).to.haveOwnProperty(
        "currentTxidIndex"
      );
      expect(body.forNetwork.Ethereum.txidStatus).to.haveOwnProperty(
        "currentMerkleroot"
      );
    }

    if (body.forNetwork.Ethereum_Goerli) {
      expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.haveOwnProperty(
        "currentTxidIndex"
      );
      expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.haveOwnProperty(
        "currentMerkleroot"
      );
    }
  }).timeout(5000); // Test seems to always take > 2000ms

  it("Should return 200 for POST /transact-proofs", async () => {
    const chainType = "0";
    const chainID = "5";
    const validBloomFilterSerialized = "someValidSerializedData";

    const response: Response = await request
      .post(`/transact-proofs/${chainType}/${chainID}/${listKey}`)
      .send({ bloomFilterSerialized: validBloomFilterSerialized });

    expect(response.status).to.equal(200);
  });

  it("Should return 400 for POST /transact-proofs with invalid body", async () => {
    const chainType = "0";
    const chainID = "5";

    const response: Response = await request
      .post(`/transact-proofs/${chainType}/${chainID}/${listKey}`)
      .send({ bloomFilterSerialized: 0 });

    expect(response.status).to.equal(400);
  });

  it("Should return 200 for POST /blocked-shields", async () => {
    const chainType = "0";
    const chainID = "5";
    const bloomFilterSerialized = "someValidSerializedData";

    const response: Response = await request
      .post(`/blocked-shields/${chainType}/${chainID}/${listKey}`)
      .send({ bloomFilterSerialized });

    expect(response.status).to.equal(200);
  });

  it("Should return 400 for POST /blocked-shields with invalid body", async () => {
    const chainType = "0";
    const chainID = "5";

    const response: Response = await request
      .post(`/blocked-shields/${chainType}/${chainID}/${listKey}`)
      .send({ bloomFilterSerialized: 0 });

    expect(response.status).to.equal(400);
  });

  it("Should return 200 for POST /submit-transact-proof", async () => {
    const chainType = "0";
    const chainID = "5";

    const transactProofData: TransactProofData = {
      // Make sure to have no empty strings in snarkProof
      snarkProof: {
        pi_a: ["some_string", "some_string"],
        pi_b: [
          ["some_string", "some_string"],
          ["some_string", "some_string"],
        ],
        pi_c: ["some_string", "some_string"],
      },
      poiMerkleroots: ["", ""],
      txidMerkleroot: "",
      txidMerklerootIndex: 0,
      blindedCommitmentOutputs: ["", ""],
    };

    const response: Response = await request
      .post(`/submit-transact-proof/${chainType}/${chainID}`)
      .send({ listKey, transactProofData });

    expect(response.status).to.equal(200);
  });

  it("Should return 400 for POST /submit-transact-proof with invalid body", async () => {
    const chainType = "0";
    const chainID = "5";

    const response: Response = await request
      .post(`/submit-transact-proof/${chainType}/${chainID}`)
      .send({ listKey, transactProofData: 0 });

    expect(response.status).to.equal(400);
  });

  it("Should return 200 for POST /pois-per-list", async () => {
    const chainType = "0";
    const chainID = "5";
    const listKeys = [listKey];

    const blindedCommitmentDatas: BlindedCommitmentData[] = [
      {
        blindedCommitment: "",
        type: BlindedCommitmentType.Transact,
      },
      {
        blindedCommitment: "",
        type: BlindedCommitmentType.Shield,
      },
    ];

    const response: Response = await request
      .post(`/pois-per-list/${chainType}/${chainID}`)
      .send({ listKeys, blindedCommitmentDatas });

    expect(response.status).to.equal(200);
  });

  it("Should return 400 for POST /pois-per-list with invalid body", async () => {
    const chainType = "0";
    const chainID = "5";

    const response: Response = await request
      .post(`/pois-per-list/${chainType}/${chainID}`)
      .send({ listKeys: 0, blindedCommitmentDatas: 0 });

    expect(response.status).to.equal(400);
  });

  it("Should return 200 for POST /merkle-proofs", async () => {
    const chainType = "0";
    const chainID = "5";
    const blindedCommitments = ["", ""];

    const response: Response = await request
      .post(`/merkle-proofs/${chainType}/${chainID}`)
      .send({ listKey, blindedCommitments });

    expect(response.status).to.equal(200);
  });

  it("Should return 400 for POST /merkle-proofs with invalid body", async () => {
    const chainType = "0";
    const chainID = "5";

    const response: Response = await request
      .post(`/merkle-proofs/${chainType}/${chainID}`)
      .send({ listKey, blindedCommitments: 0 });

    expect(response.status).to.equal(400);
  });

  it("Should return 200 for POST /validate-txid-merkleroot", async () => {
    const chainType = "0";
    const chainID = "5";
    const tree = 0;
    const index = 0;
    const merkleroot = "";

    const response: Response = await request
      .post(`/validate-txid-merkleroot/${chainType}/${chainID}`)
      .send({ tree, index, merkleroot });

    expect(response.status).to.equal(200);
  });

  it("Should return 400 for POST /validate-txid-merkleroot with invalid body", async () => {
    const chainType = "0";
    const chainID = "5";

    const response: Response = await request
      .post(`/validate-txid-merkleroot/${chainType}/${chainID}`)
      .send({ tree: 0, index: 0, merkleroot: 0 });

    expect(response.status).to.equal(400);
  });
});
