import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  NETWORK_CONFIG,
  NetworkName,
  POIEventType,
  POIStatus,
  TXIDVersion,
  delay,
  isDefined,
  isHistoricalRelayAdaptContractAddress,
} from '@railgun-community/shared-models';
import { chainForNetwork, networkForName } from '../config/general';
import {
  ShieldData,
  getRailgunTxidsForUnshields,
  scanUpdatesForMerkletreeAndWallets,
} from '@railgun-community/wallet';
import debug from 'debug';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { Config } from '../config/config';
import { ShieldQueueDBItem, ShieldStatus } from '../models/database-types';
import { StatusDatabase } from '../database/databases/status-database';
import { getNewShieldsFromWallet } from '../engine/wallet';
import {
  getTransactionReceipt,
  getTimestampFromTransactionReceipt,
} from '../rpc-providers/tx-receipt';
import { Constants } from '../config/constants';
import { ListProviderPOIEventQueue } from './list-provider-poi-event-queue';
import { POIEventShield } from '../models/poi-types';
import { ListProviderBlocklist } from './list-provider-blocklist';
import { hoursAgo, minutesAgo } from '../util/time-ago';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { validateTimestamp } from '../util/timestamp';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';

export type ListProviderConfig = {
  name: string;
  description: string;
  queueShieldsOverrideDelayMsec?: number;
  categorizeUnknownShieldsOverrideDelayMsec?: number;
  validateShieldsOverrideDelayMsec?: number;
  addAllowedShieldsOverrideDelayMsec?: number;
  ensureAddedShieldsHaveEventsOverrideDelayMsec?: number;
  rescanHistoryOverrideDelayMsec?: number;
};

// 30 seconds
const DEFAULT_QUEUE_SHIELDS_DELAY_MSEC = 30 * 1000;
// 10 seconds
const CATEGORIZE_UNKNOWN_SHIELDS_DELAY_MSEC = 10 * 1000;
// 10 seconds
const DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC = 10 * 1000;
// 30 seconds
const DEFAULT_ADD_ALLOWED_SHIELDS_DELAY_MSEC = 30 * 1000;
// 30 seconds
const DEFAULT_ENSURE_ADDED_SHIELDS_HAVE_EVENTS_DELAY_MSEC = 10 * 60 * 1000;
// 5 minutes
const DEFAULT_RESCAN_HISTORY_DELAY_MSEC = 5 * 60 * 1000;

const dbg = debug('poi:list-provider');

export abstract class ListProvider {
  listKey: string;

  protected abstract config: ListProviderConfig;

  constructor(listKey: string) {
    dbg(`LIST KEY: ${listKey}`);

    this.listKey = listKey;

    ListProviderPOIEventQueue.init(listKey);
    ListProviderBlocklist.init(listKey);
  }

  protected abstract shouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ): Promise<{ shouldAllow: boolean; blockReason?: string }>;

  startPolling() {
    if (!isDefined(this.listKey)) {
      throw new Error('Must call init on ListProvider before polling.');
    }
    dbg(
      `List ${this.config.name} polling for new shields and validating queued shields...`,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runQueueNewUnknownShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runCategorizeUnknownShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidatePendingShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runAddAllowedShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runEnsureAddedShieldsHaveEventsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runRescanHistoryPoller();

    ListProviderPOIEventQueue.startPolling();
  }

  private async runQueueNewUnknownShieldsPoller() {
    // Run for each network in series.
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.queueNewUnknownShields(networkName, txidVersion);
      }
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_QUEUE_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runQueueNewUnknownShieldsPoller();
  }

  private async runCategorizeUnknownShieldsPoller() {
    // Run for each network in series.
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.categorizeUnknownShields(networkName, txidVersion);
      }
    }

    await delay(
      this.config.categorizeUnknownShieldsOverrideDelayMsec ??
        CATEGORIZE_UNKNOWN_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runCategorizeUnknownShieldsPoller();
  }

  private async runValidatePendingShieldsPoller() {
    // Run for each network in series.
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.validateNextPendingShieldBatch(networkName, txidVersion);
      }
    }

    await delay(
      this.config.validateShieldsOverrideDelayMsec ??
        DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidatePendingShieldsPoller();
  }

  private async runAddAllowedShieldsPoller() {
    // Run for each network in series.
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.addAllowedShields(networkName, txidVersion);
      }
    }

    await delay(
      this.config.addAllowedShieldsOverrideDelayMsec ??
        DEFAULT_ADD_ALLOWED_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runAddAllowedShieldsPoller();
  }

  private async runEnsureAddedShieldsHaveEventsPoller() {
    // Run for each network in series.
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.ensureAddedShieldsHaveEvents(networkName, txidVersion);
      }
    }

    await delay(
      this.config.ensureAddedShieldsHaveEventsOverrideDelayMsec ??
        DEFAULT_ENSURE_ADDED_SHIELDS_HAVE_EVENTS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runEnsureAddedShieldsHaveEventsPoller();
  }

  private async runRescanHistoryPoller() {
    // Delay on first run - Engine is scanned on initialization.
    await delay(
      this.config.rescanHistoryOverrideDelayMsec ??
        DEFAULT_RESCAN_HISTORY_DELAY_MSEC,
    );

    for (const networkName of Config.NETWORK_NAMES) {
      const chain = chainForNetwork(networkName);
      await scanUpdatesForMerkletreeAndWallets(chain);
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runRescanHistoryPoller();
  }

  async queueNewUnknownShields(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<void> {
    const statusDB = new StatusDatabase(networkName, txidVersion);
    const status = await statusDB.getStatus();
    const network = networkForName(networkName);
    const startingBlock = status?.latestBlockScanned ?? network.deploymentBlock;

    const newShields: ShieldData[] = await getNewShieldsFromWallet(
      networkName,
      startingBlock,
    );

    dbg(
      `[${networkName}] Attempting to insert ${newShields.length} unknown shields`,
    );

    for (const shieldData of newShields) {
      const queued = await this.queueShieldSafe(
        networkName,
        txidVersion,
        shieldData,
      );
      if (queued) {
        const lastShieldScanned = newShields[newShields.length - 1];
        const latestBlockScanned = lastShieldScanned.blockNumber;
        await statusDB.saveStatus(latestBlockScanned);
      }
    }
  }

  async categorizeUnknownShields(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
      const unknownShields = await shieldQueueDB.getShields(
        ShieldStatus.Unknown,
      );

      dbg(
        `[${networkName}] Attempting to categorize ${unknownShields.length} unknown shields...`,
      );

      for (const shieldQueueDBItem of unknownShields) {
        await this.categorizeUnknownShield(
          networkName,
          txidVersion,
          shieldQueueDBItem,
        );
      }
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `[${networkName}] Error categorizing shield on ${networkName}: ${err.message}`,
      );
    }
  }

  private async categorizeUnknownShield(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldQueueDBItem: ShieldQueueDBItem,
  ) {
    const { txid } = shieldQueueDBItem;

    if (
      validateTimestamp(shieldQueueDBItem.timestamp) <
      this.getMaxTimestampForValidation(networkName)
    ) {
      // Automatically mark pending if it's an old shield.
      await this.markShieldPending(networkName, txidVersion, shieldQueueDBItem);
      return;
    }

    const txReceipt = await getTransactionReceipt(networkName, txid);
    const toAddress = txReceipt?.to;
    if (!isDefined(toAddress)) {
      throw new Error('Transaction receipt missing "to" address');
    }
    const isRelayAdaptContractCall = isHistoricalRelayAdaptContractAddress(
      networkName,
      toAddress,
    );
    if (!isRelayAdaptContractCall) {
      await this.markShieldPending(networkName, txidVersion, shieldQueueDBItem);
      return;
    }

    await this.handleRelayAdaptUnknownShield(
      networkName,
      txidVersion,
      shieldQueueDBItem,
    );
  }

  // TODO: Needs tests for each case.
  private async handleRelayAdaptUnknownShield(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldQueueDBItem: ShieldQueueDBItem,
  ) {
    // PROCESS FOR RELAY ADAPT UNSHIELD+SHIELDS:
    // 1. Check if any unshield exists for this eth txid.
    // 2. If no unshield exists, then assume it's a base-token-shield. Mark as pending (will run the delay before a full POI List check).
    // 3. If any unshield exists, find POI Status for each unshield railgunTxid (blindedCommitment).
    // 4. Handle poi status for every unshield

    // 1. Check if any unshield exists for this eth txid.
    const chain = chainForNetwork(networkName);
    const unshieldRailgunTxids: string[] = await getRailgunTxidsForUnshields(
      chain,
      shieldQueueDBItem.txid,
    );

    // 2. If no unshield exists, then we assume it's a base-token-shield.
    // Mark as pending (will run the delay before a full POI List check).
    if (!unshieldRailgunTxids.length) {
      await this.markShieldPending(networkName, txidVersion, shieldQueueDBItem);
      return;
    }

    // 3. If any unshield exists, find POI Status for each unshield railgunTxid (by blindedCommitments).
    const poiStatuses: POIStatus[] = []
    for (const unshieldRailgunTxid of unshieldRailgunTxids) {
      const blindedCommitment = unshieldRailgunTxid;
      const blindedCommitmentData: BlindedCommitmentData = {
        blindedCommitment,
        type: BlindedCommitmentType.Unshield,
      };
      poiStatuses.push(await POIMerkletreeManager.getPOIStatus(
        this.listKey,
        networkName,
        txidVersion,
        blindedCommitmentData,
      ));
    }

    // If all Unshield POI statuses are Valid, automatically Allow Relay Adapt Shield
    if (poiStatuses.every(status => status === POIStatus.Valid)) {
      await this.allowShield(networkName, txidVersion, shieldQueueDBItem);
      return;
    }

    // If 1+ POI status is "TransactProofSubmitted" or "Missing",
    // Mark as pending (will run the delay before a full POI List check)
    const anyStatusIsPending =
      poiStatuses.find(
        status =>
          status === POIStatus.ProofSubmitted || status === POIStatus.Missing,
      ) != null;

    if (anyStatusIsPending) {
      // If shield is >60 min old, mark as pending.
      if (validateTimestamp(shieldQueueDBItem.timestamp) < hoursAgo(1)) {
        await this.markShieldPending(
          networkName,
          txidVersion,
          shieldQueueDBItem,
        );
      }
      // Otherwise, wait for next iteration.
      return;
    }

    // ShieldBlocked and ShieldPending are not possible for Transact proof POIStatus.
    // Mark as pending byt default (will run the delay before a full POI List check)
    await this.markShieldPending(networkName, txidVersion, shieldQueueDBItem);
  }

  private async markShieldPending(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldQueueDBItem: ShieldQueueDBItem,
  ) {
    const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
    await shieldQueueDB.updateShieldStatus(
      shieldQueueDBItem,
      ShieldStatus.Pending,
    );
  }

  private async queueShieldSafe(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldData: ShieldData,
  ): Promise<boolean> {
    try {
      if (!isDefined(shieldData.timestamp)) {
        const txReceipt = await getTransactionReceipt(
          networkName,
          shieldData.txid,
        );
        const timestamp = await getTimestampFromTransactionReceipt(
          networkName,
          txReceipt,
        );
        shieldData.timestamp = timestamp;
      }

      validateTimestamp(shieldData.timestamp);

      const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
      await shieldQueueDB.insertUnknownShield(shieldData);
      return true;
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `[${networkName}] Error queuing shield: ${err.message}`,
      );
      dbg(shieldData);
      return false;
    }
  }

  private getMaxTimestampForValidation(networkName: NetworkName) {
    const network = networkForName(networkName);
    if (network.isTestnet === true) {
      return minutesAgo(Constants.MINUTES_SHIELD_PENDING_PERIOD_TESTNET);
    }
    return hoursAgo(Constants.HOURS_SHIELD_PENDING_PERIOD);
  }

  async validateNextPendingShieldBatch(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<void> {
    const endTimestamp = this.getMaxTimestampForValidation(networkName);
    let pendingShields: ShieldQueueDBItem[];
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
      const limit = 1000;
      pendingShields = await shieldQueueDB.getShields(
        ShieldStatus.Pending,
        endTimestamp,
        limit,
      );
      if (pendingShields.length === 0) {
        return;
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error getting queued shields on ${networkName}: ${err.message}`);
      return;
    }

    dbg(
      `[${networkName}] Validating ${pendingShields.length} pending shields...`,
    );

    for (const shieldData of pendingShields) {
        await this.validateShield(networkName, txidVersion, shieldData, endTimestamp)
    }
  }

  private async validateShield(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldDBItem: ShieldQueueDBItem,
    endTimestamp: number,
  ) {
    const { txid } = shieldDBItem;
    try {
      const txReceipt = await getTransactionReceipt(networkName, txid);
      const timestamp = await getTimestampFromTransactionReceipt(
        networkName,
        txReceipt,
      );
      if (endTimestamp < validateTimestamp(timestamp)) {
        // Shield is too new to validate
        throw new Error('Invalid timestamp');
      }

      const poiSettings = NETWORK_CONFIG[networkName].poi;

      if (
        isDefined(poiSettings) &&
        poiSettings.launchBlock < txReceipt.blockNumber
      ) {
        return await this.allowShield(networkName, txidVersion, shieldDBItem);
      }

      const { shouldAllow, blockReason } = await this.shouldAllowShield(
        networkName,
        txid,
        txReceipt.from.toLowerCase(),
        timestamp,
      );

      if (shouldAllow) {
        return await this.allowShield(networkName, txidVersion, shieldDBItem);
      } else {
        return await this.blockShield(
          networkName,
          txidVersion,
          shieldDBItem,
          blockReason,
        );
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error validating queued shield on ${networkName}: ${err.message}`);
      dbg(shieldDBItem);
    }
  }

  async addAllowedShields(networkName: NetworkName, txidVersion: TXIDVersion) {
    const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
    const allowedShields = await shieldQueueDB.getShields(ShieldStatus.Allowed);

    dbg(
      `[${networkName}] Attempting to queue POI events for ${allowedShields.length} allowed shields...`,
    );

    for (const shieldDBItem of allowedShields) {
      const orderedEventsDB = new POIOrderedEventsDatabase(
        networkName,
        txidVersion,
      );
      if (
        await orderedEventsDB.eventExists(
          this.listKey,
          shieldDBItem.blindedCommitment,
        )
      ) {
        const shieldQueueDB = new ShieldQueueDatabase(
          networkName,
          txidVersion,
        );
        await shieldQueueDB.updateShieldStatus(
          shieldDBItem,
          ShieldStatus.AddedPOI,
        );
        continue;
      }

      // Allow - add POIEvent
      const poiEventShield: POIEventShield = {
        type: POIEventType.Shield,
        commitmentHash: shieldDBItem.commitmentHash,
        blindedCommitment: shieldDBItem.blindedCommitment,
      };
      ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
        this.listKey,
        networkName,
        txidVersion,
        poiEventShield,
      );
    }
  }

  async ensureAddedShieldsHaveEvents(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    const orderedEventsDB = new POIOrderedEventsDatabase(
      networkName,
      txidVersion,
    );
    const countShieldEvents = await orderedEventsDB.getCount(
      this.listKey,
      POIEventType.Shield,
    );
    const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
    const countAddedPOIShields = await shieldQueueDB.getCount(
      ShieldStatus.AddedPOI,
    );
    if (countShieldEvents === countAddedPOIShields) {
      return;
    }

    dbg(
      'DANGER: Missing some POI events for added shields. Automatically trying to add the missing events.',
    );
    const addedPOIShieldsStream = await shieldQueueDB.streamAddedPOIShields();

    for await (const addedPOIShield of addedPOIShieldsStream) {
      const orderedEventsDB = new POIOrderedEventsDatabase(
        networkName,
        txidVersion,
      );
      if (
        !(await orderedEventsDB.eventExists(
          this.listKey,
          addedPOIShield.blindedCommitment,
        ))
      ) {
        const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
        await shieldQueueDB.updateShieldStatus(
          addedPOIShield,
          ShieldStatus.Allowed,
        );
        dbg(`ADDED MISSING shield POI event:`);
        dbg(addedPOIShield);
      }
    }
  }

  private async allowShield(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldDBItem: ShieldQueueDBItem,
  ) {
    // Update status in DB
    const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
    await shieldQueueDB.updateShieldStatus(shieldDBItem, ShieldStatus.Allowed);
    await this.addAllowedShields(networkName, txidVersion);
  }

  private async blockShield(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldDBItem: ShieldQueueDBItem,
    blockReason: Optional<string>,
  ) {
    // Block - add BlockedShield
    await ListProviderBlocklist.addBlockedShield(
      networkName,
      txidVersion,
      shieldDBItem,
      blockReason,
    );

    // Update status in DB
    const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
    await shieldQueueDB.updateShieldStatus(shieldDBItem, ShieldStatus.Blocked);
  }
}
