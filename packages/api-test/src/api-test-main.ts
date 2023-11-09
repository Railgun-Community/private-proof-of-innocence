import debug from "debug";
import { POINodeRequest } from "./api-test-poi-node-request";
import { NetworkName, TXIDVersion } from "@railgun-community/shared-models";
import { POIEventList } from "../../node/src/poi-events/poi-event-list";
import { DatabaseClient } from "../../node/src/database/database-client-init";
import { Config } from "../../node/src/config/config";

const dbg = debug("api-test:main");

const main = async () => {
  try {
    // const nodeURL = 'http://localhost:8080';
    // const eventRange = await POINodeRequest.getPOIListEventRange(
    //   nodeURL,
    //   NetworkName.Ethereum,
    //   TXIDVersion.V2_PoseidonMerkle,
    //   'efc6ddb59c098a13fb2b618fdae94c1c3a807abc8fb1837c93620c9143ee9e88',
    //   11638,
    //   11643,
    // );
    // dbg(eventRange);

    Config.MONGODB_URL = "mongodb://localhost:27017";
    await DatabaseClient.init();
    // await POIEventList.deleteAllPOIEventsForList_DANGEROUS('55049dc47b4435bca4a8f8ac27b1858e409f9f72b317fde4a442095cfc454893', NetworkName.EthereumGoerli, TXIDVersion.V2_PoseidonMerkle);
    dbg("Test complete");
  } catch (err) {
    dbg(err);
  }
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
