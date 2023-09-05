export enum CollectionName {
  Status = 'Status',
  ShieldQueue = 'ShieldQueue',
}

export enum ShieldStatus {
  // Waiting for validation
  Pending = 'Pending',

  // Validation statuses
  Allowed = 'Allowed',
  Blocked = 'Blocked',

  // POI status
  AddedPOI = 'AddedPOI',
}

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type ShieldQueueDBItem = {
  txid: string;
  hash: string;
  timestamp: number;
  status: ShieldStatus;
  lastValidatedTimestamp: Optional<number>;
};

export type StatusDBItem = {
  latestBlockScanned: number;
};
