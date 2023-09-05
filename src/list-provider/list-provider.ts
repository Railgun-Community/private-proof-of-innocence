import {
  NetworkName,
  delay,
  isDefined,
} from '@railgun-community/shared-models';
import { networkForName } from '../config/general';
import { ShieldData, getAllShields } from '@railgun-community/wallet';
import debug from 'debug';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { Config } from '../config/config';
import { ShieldQueueDBItem } from '../models/database-types';
import { getProviderForNetwork } from '../rpc-providers/active-network-providers';
import { TransactionReceipt } from 'ethers';
import { StatusDatabase } from '../database/databases/status-database';

export type ListProviderConfig = {
  name: string;
  description: string;
  queueShieldsOverrideDelayMsec?: number;
  validateShieldsOverrideDelayMsec?: number;
};

// 30 minutes
const DEFAULT_QUEUE_SHIELDS_DELAY_MSEC = 30 * 60 * 1000;

// 30 seconds
const DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC = 30 * 1000;

// DO NOT MODIFY
const DAYS_WAITING_PERIOD = 7;

const dbg = debug('poi:list-provider');

export abstract class ListProvider {
  readonly id: string;

  protected abstract config: ListProviderConfig;

  private shouldPoll = false;

  constructor(id: string) {
    this.id = id;
  }

  protected abstract shouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ): Promise<boolean>;

  async startPolling() {
    dbg(
      `List ${this.config.name} polling for new shields and validating queued shields...`,
    );

    this.shouldPoll = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runQueueShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidateQueuedShieldsPoller();
  }

  async stopPolling() {
    dbg(`Stopping ${this.config.name} polling...`);

    this.shouldPoll = false;
  }

  private async runQueueShieldsPoller() {
    if (!this.shouldPoll) {
      return;
    }

    // Run for each network in series.
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.queueNewShields(networkName);
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_QUEUE_SHIELDS_DELAY_MSEC,
    );
  }

  private async runValidateQueuedShieldsPoller() {
    if (!this.shouldPoll) {
      return;
    }

    // Run for each network in series.
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.validateNextQueuedShieldBatch(networkName);
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC,
    );
  }

  async queueNewShields(networkName: NetworkName): Promise<void> {
    const statusDB = new StatusDatabase(networkName);
    const status = await statusDB.getStatus();
    const network = networkForName(networkName);
    const startingBlock = status?.latestBlockScanned ?? network.deploymentBlock;

    const newShields = await getAllShields(networkName, startingBlock);

    await Promise.all(
      newShields.map((shieldData) =>
        this.queueShieldSafe(networkName, shieldData),
      ),
    );
  }

  private async queueShieldSafe(
    networkName: NetworkName,
    shieldData: ShieldData,
  ) {
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      await shieldQueueDB.insertPendingShield(shieldData);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error queuing shield on ${networkName}: ${err.message}`);
      dbg(shieldData);
    }
  }

  private getMaxTimestampForValidation() {
    return Date.now() - DAYS_WAITING_PERIOD * 24 * 60 * 60 * 1000;
  }

  async validateNextQueuedShieldBatch(networkName: NetworkName): Promise<void> {
    const endTimestamp = this.getMaxTimestampForValidation();
    let pendingShields: ShieldQueueDBItem[];
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      pendingShields = await shieldQueueDB.getPendingShields(endTimestamp);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error getting queued shields on ${networkName}: ${err.message}`);
      return;
    }
    await Promise.all(
      pendingShields.map((shieldData) =>
        this.validateShield(networkName, shieldData, endTimestamp),
      ),
    );
  }

  private async validateShield(
    networkName: NetworkName,
    shieldData: ShieldQueueDBItem,
    endTimestamp: number,
  ) {
    const { txid } = shieldData;
    try {
      const txReceipt = await this.getTransactionReceipt(networkName, txid);
      const timestamp = await this.getValidTimestamp(
        networkName,
        txReceipt,
        endTimestamp,
      );
      const shouldAllow = await this.shouldAllowShield(
        networkName,
        txid,
        txReceipt.from.toLowerCase(),
        timestamp,
      );

      // Update status in DB
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      await shieldQueueDB.updateShieldStatus(shieldData, shouldAllow);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error validating queued shield on ${networkName}: ${err.message}`);
      dbg(shieldData);
    }
  }

  private async getTransactionReceipt(
    networkName: NetworkName,
    txid: string,
  ): Promise<TransactionReceipt> {
    const provider = getProviderForNetwork(networkName);
    const txReceipt = await provider.getTransactionReceipt(txid);
    if (!isDefined(txReceipt)) {
      throw new Error(`Transaction receipt not found for ${txid}`);
    }
    return txReceipt;
  }

  private async getValidTimestamp(
    networkName: NetworkName,
    txReceipt: TransactionReceipt,
    endTimestamp: number,
  ): Promise<number> {
    const provider = getProviderForNetwork(networkName);
    const block = await provider.getBlock(txReceipt.blockNumber);
    if (!isDefined(block)) {
      throw new Error(`Block data not found for ${txReceipt.blockNumber}`);
    }
    const timestamp = block.timestamp;
    if (timestamp > endTimestamp / 1000) {
      throw new Error('Invalid timestamp');
    }
    return timestamp;
  }
}
