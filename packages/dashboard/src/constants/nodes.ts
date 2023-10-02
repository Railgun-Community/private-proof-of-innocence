export enum AvailableNodes {
  Local = 'http://localhost:3010',
  Blank = 'https://blank-node.innocence-station.com:8080',
  OFAC = 'https://ofac-node.innocence-station.com:8080',
}

export const availableNodesArray = Object.values(AvailableNodes);
