export type StatusDBEntry = {
  latestBlockScanned: number;
};

export enum ShieldStatus {
  Pending = 'Pending',
  Allowed = 'Allowed',
  Blocked = 'Blocked',
}

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type ShieldDBEntry = {
  txid: string;
  hash: string;
  timestamp: number;
  status: ShieldStatus;
  lastValidatedTimestamp: Optional<number>;
};
