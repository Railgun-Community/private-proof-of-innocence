import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  NETWORK_CONFIG,
  NetworkName,
  POIStatus,
  delay,
  isDefined,
  isHistoricalRelayAdaptContractAddress,
} from '@railgun-community/shared-models';
import { chainForNetwork, networkForName } from '../config/general';
import {
  ShieldData,
  getUnshieldRailgunTransactionBlindedCommitmentGroups,
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
import { ListProviderPOIEventUpdater } from './list-provider-poi-event-updater';
import { POIEventShield, POIEventType } from '../models/poi-types';
import { ListProviderBlocklist } from './list-provider-blocklist';
import { hoursAgo } from '../util/time-ago';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';

export type ListProviderConfig = {
  name: string;
  description: string;
  queueShieldsOverrideDelayMsec?: number;
  categorizeUnknownShieldsOverrideDelayMsec?: number;
  validateShieldsOverrideDelayMsec?: number;
};

// 20 minutes
const DEFAULT_QUEUE_SHIELDS_DELAY_MSEC = 20 * 60 * 1000;
// 30 seconds
const CATEGORIZE_UNKNOWN_SHIELDS_DELAY_MSEC = 30 * 1000;
// 30 seconds
const DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC = 30 * 1000;

const dbg = debug('poi:list-provider');

export abstract class ListProvider {
  listKey: string;

  protected abstract config: ListProviderConfig;

  constructor(listKey: string) {
    dbg(`LIST KEY: ${listKey}`);

    this.listKey = listKey;

    ListProviderPOIEventQueue.init(listKey);
    ListProviderPOIEventUpdater.init(listKey);
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
    this.runQueueShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runCategorizeUnknownShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidatePendingShieldsPoller();

    ListProviderPOIEventQueue.startPolling();
    ListProviderPOIEventUpdater.startPolling();
  }

  private async runQueueShieldsPoller() {
    // Run for each network in series.
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.queueNewShields(networkName);
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_QUEUE_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runQueueShieldsPoller();
  }

  private async runCategorizeUnknownShieldsPoller() {
    // Run for each network in series.
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.categorizeUnknownShields(networkName);
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
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.validateNextPendingShieldBatch(networkName);
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidatePendingShieldsPoller();
  }

  async queueNewShields(networkName: NetworkName): Promise<void> {
    const statusDB = new StatusDatabase(networkName);
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

    await Promise.all(
      newShields.map(shieldData =>
        this.queueShieldSafe(networkName, shieldData),
      ),
    );

    if (newShields.length > 0) {
      const lastShieldScanned = newShields[newShields.length - 1];
      const latestBlockScanned = lastShieldScanned.blockNumber;
      await statusDB.saveStatus(latestBlockScanned);
    }
  }

  async categorizeUnknownShields(networkName: NetworkName) {
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      const unknownShields = await shieldQueueDB.getShields(
        ShieldStatus.Unknown,
      );
      for (const shieldQueueDBItem of unknownShields) {
        await this.categorizeUnknownShield(networkName, shieldQueueDBItem);
      }
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `[${networkName}] Error queuing shield on ${networkName}: ${err.message}`,
      );
    }
  }

  private async categorizeUnknownShield(
    networkName: NetworkName,
    shieldQueueDBItem: ShieldQueueDBItem,
  ) {
    const { txid } = shieldQueueDBItem;

    if (shieldQueueDBItem.timestamp < this.getMaxTimestampForValidation()) {
      // Automatically mark pending if it's an old shield.
      await this.markShieldPending(networkName, shieldQueueDBItem);
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
      await this.markShieldPending(networkName, shieldQueueDBItem);
      return;
    }

    await this.handleRelayAdaptUnknownShield(
      networkName,
      shieldQueueDBItem,
      toAddress,
    );
  }

  // TODO: Needs tests for each case.
  private async handleRelayAdaptUnknownShield(
    networkName: NetworkName,
    shieldQueueDBItem: ShieldQueueDBItem,
    toAddress: string,
  ) {
    // PROCESS FOR RELAY ADAPT UNSHIELD+SHIELDS:
    // 1. Check if any unshield exists for this eth txid.
    // 2. If no unshield exists, then assume it's a base-token-shield. Mark as pending (will run the delay before a full POI List check).
    // 3. If any unshield exists, find POI Status for each unshield railgunTxid (blindedCommitment).
    // 4. Handle poi status for every unshield

    // 1. Check if any unshield exists for this eth txid.
    const chain = chainForNetwork(networkName);
    const unshieldRailgunTransactionBlindedCommitmentGroups: string[][] =
      await getUnshieldRailgunTransactionBlindedCommitmentGroups(
        chain,
        shieldQueueDBItem.txid,
        toAddress, // Relay Adapt contract address
      );

    // 2. If no unshield exists, then we assume it's a base-token-shield.
    // Mark as pending (will run the delay before a full POI List check).
    if (!unshieldRailgunTransactionBlindedCommitmentGroups.length) {
      await this.markShieldPending(networkName, shieldQueueDBItem);
      return;
    }

    // 3. If any unshield exists, find POI Status for each unshield railgunTxid (by blindedCommitments).
    const allBlindedCommitments: string[] =
      unshieldRailgunTransactionBlindedCommitmentGroups.flat();

    const poiStatuses: POIStatus[] = await Promise.all(
      allBlindedCommitments.map(async blindedCommitment => {
        const blindedCommitmentData: BlindedCommitmentData = {
          blindedCommitment,
          type: BlindedCommitmentType.Transact,
        };
        return POIMerkletreeManager.getPOIStatus(
          this.listKey,
          networkName,
          blindedCommitmentData,
        );
      }),
    );

    // If all Unshield POI statuses are Valid, automatically Allow Relay Adapt Shield
    if (poiStatuses.every(status => status === POIStatus.Valid)) {
      await this.allowShield(networkName, shieldQueueDBItem);
      return;
    }

    // If 1+ POI status is "TransactProofSubmitted" or "Missing",
    // Mark as pending (will run the delay before a full POI List check)
    const anyStatusIsPending =
      poiStatuses.find(
        status =>
          status === POIStatus.TransactProofSubmitted ||
          status === POIStatus.Missing,
      ) != null;

    if (anyStatusIsPending) {
      // If shield is >60 min old, mark as pending.
      if (shieldQueueDBItem.timestamp < hoursAgo(1)) {
        await this.markShieldPending(networkName, shieldQueueDBItem);
      }
      // Otherwise, wait for next iteration.
      return;
    }

    // ShieldBlocked and ShieldPending are not possible for Transact proof POIStatus.
    // Mark as pending byt default (will run the delay before a full POI List check)
    await this.markShieldPending(networkName, shieldQueueDBItem);
  }

  private async markShieldPending(
    networkName: NetworkName,
    shieldQueueDBItem: ShieldQueueDBItem,
  ) {
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    await shieldQueueDB.updateShieldStatus(
      shieldQueueDBItem,
      ShieldStatus.Pending,
    );
  }

  private async queueShieldSafe(
    networkName: NetworkName,
    shieldData: ShieldData,
  ) {
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      await shieldQueueDB.insertUnknownShield(shieldData);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(
        `[${networkName}] Error queuing shield on ${networkName}: ${err.message}`,
      );
      dbg(shieldData);
    }
  }

  private getMaxTimestampForValidation() {
    return hoursAgo(Constants.HOURS_SHIELD_PENDING_PERIOD);
  }

  async validateNextPendingShieldBatch(
    networkName: NetworkName,
  ): Promise<void> {
    const endTimestamp = this.getMaxTimestampForValidation();
    let pendingShields: ShieldQueueDBItem[];
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      const limit = 100;
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

    await Promise.all(
      pendingShields.map(shieldData =>
        this.validateShield(networkName, shieldData, endTimestamp),
      ),
    );
  }

  private async validateShield(
    networkName: NetworkName,
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
      if (timestamp > endTimestamp) {
        // Shield is too new to validate
        throw new Error('Invalid timestamp');
      }

      const poiSettings = NETWORK_CONFIG[networkName].poi;

      if (
        isDefined(poiSettings) &&
        poiSettings.launchBlock < txReceipt.blockNumber
      ) {
        return await this.allowShield(networkName, shieldDBItem);
      }

      const { shouldAllow, blockReason } = await this.shouldAllowShield(
        networkName,
        txid,
        txReceipt.from.toLowerCase(),
        timestamp,
      );

      if (shouldAllow) {
        return await this.allowShield(networkName, shieldDBItem);
      } else {
        return await this.blockShield(networkName, shieldDBItem, blockReason);
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error validating queued shield on ${networkName}: ${err.message}`);
      dbg(shieldDBItem);
    }
  }

  private async allowShield(
    networkName: NetworkName,
    shieldDBItem: ShieldQueueDBItem,
  ) {
    // Allow - add POIEvent
    const poiEventShield: POIEventShield = {
      type: POIEventType.Shield,
      commitmentHash: shieldDBItem.commitmentHash,
      blindedCommitment: shieldDBItem.blindedCommitment,
    };
    ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
      networkName,
      poiEventShield,
    );

    // Update status in DB
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    await shieldQueueDB.updateShieldStatus(shieldDBItem, ShieldStatus.Allowed);
  }

  private async blockShield(
    networkName: NetworkName,
    shieldDBItem: ShieldQueueDBItem,
    blockReason: Optional<string>,
  ) {
    // Block - add BlockedShield
    await ListProviderBlocklist.addBlockedShield(
      networkName,
      shieldDBItem,
      blockReason,
    );

    // Update status in DB
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    await shieldQueueDB.updateShieldStatus(shieldDBItem, ShieldStatus.Blocked);
  }
}
