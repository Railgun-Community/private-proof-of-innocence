const aggregatorNodeURL = 'https://poi.us.proxy.railwayapi.xyz/node-status-v2/';

export enum AvailableNodes {
  // Local = 'http://localhost:3010', // TODO: Delete local if it's needed.
  // Blank = 'https://blank-node.innocence-station.com:8080',
  // OFAC = 'https://ofac-node.innocence-station.com:8080',
  Aggregator = aggregatorNodeURL,
  OFAC = `${aggregatorNodeURL}efc6ddb59c098a13fb2b618fdae94c1c3a807abc8fb1837c93620c9143ee9e88`,
  Blank = `${aggregatorNodeURL}55049dc47b4435bca4a8f8ac27b1858e409f9f72b317fde4a442095cfc454893`,
}

export const availableNodesArray = Object.values(AvailableNodes);

export const availableNodesArrayWithKeys = Object.keys(AvailableNodes).map(
  (key, index) => ({
    key,
    value: availableNodesArray[index],
  }),
);
