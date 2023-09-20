export class QueryLimits {
  // Max number of commitments for a single transaction
  static readonly GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS = 13;

  static readonly GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS = 30;

  static readonly MAX_EVENT_QUERY_RANGE_LENGTH = 100;

  static readonly PROOF_MEMPOOL_SYNCED_ITEMS = 100;

  static readonly BLOCKED_SHIELDS_SYNCED_ITEMS = 50;
}
