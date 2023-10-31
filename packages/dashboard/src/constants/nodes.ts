const aggregatorNodeURL = 'https://poi.us.proxy.railwayapi.xyz/node-status-v2/';

export enum AvailableNodes {
  AggregatorDocuDB = 'https://poi-lb.us.proxy.railwayapi.xyz/node-status-v2/',
  Aggregator = aggregatorNodeURL,
  OFAC = `${aggregatorNodeURL}efc6ddb59c098a13fb2b618fdae94c1c3a807abc8fb1837c93620c9143ee9e88`,
  Blank = `${aggregatorNodeURL}55049dc47b4435bca4a8f8ac27b1858e409f9f72b317fde4a442095cfc454893`,
}

export const availableNodesArray = Object.values(AvailableNodes).filter(
  value => typeof value === 'string' && value.startsWith('https://'),
);

export const availableNodesArrayWithKeys = Object.keys(AvailableNodes).map(
  (key, index) => ({
    key,
    value: availableNodesArray[index],
  }),
);
