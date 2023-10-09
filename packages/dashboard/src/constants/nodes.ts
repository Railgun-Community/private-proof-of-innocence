export enum AvailableNodes {
  // Local = 'http://localhost:3010', // TODO: Delete local if it's needed.
  Blank = 'https://blank-node.innocence-station.com:8080',
  OFAC = 'https://ofac-node.innocence-station.com:8080',
  Aggregator = 'https://poi.us.proxy.railwayapi.xyz',
}

export const availableNodesArray = Object.values(AvailableNodes);

export const availableNodesArrayWithKeys = Object.keys(AvailableNodes).map(
  (key, index) => ({
    key,
    value: availableNodesArray[index],
  }),
);
