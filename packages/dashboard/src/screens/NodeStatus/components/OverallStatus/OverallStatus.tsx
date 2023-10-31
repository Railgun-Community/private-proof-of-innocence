import {
  isDefined,
  NodeStatusForNetwork,
  POIListStatus,
} from '@railgun-community/shared-models';
import { Button } from '@components/Button/Button';
import { Text } from '@components/Text/Text';
import { useNodeStore } from '@state/stores';
import { shortenWalletAddress } from '@utils/address';
import { getLastRefreshedTimeText } from '@utils/date';
import { IconType } from '@utils/icon-service';
import styles from './OverallStatus.module.scss';
import colors from '@scss/colors.module.scss';

type Props = {
  nodeStatus: Optional<NodeStatusForNetwork>;
};

type EventListStatus = {
  id: string;
  value: POIListStatus;
};

type SyncProps = {
  isInSync: boolean;
  outOfSyncMessage?: string;
};

export const OverallStatus = ({ nodeStatus }: Props) => {
  const {
    refreshNode,
    lastRefreshedNodeStatusForAllNetworks,
    refreshingNode,
    nodeIp,
  } = useNodeStore();
  const listStatuses = nodeStatus?.listStatuses ?? undefined;

  const arrayOfEventListStatuses: EventListStatus[] = isDefined(listStatuses)
    ? Object.entries(listStatuses).map(([key, value]) => ({
        id: key,
        value,
      }))
    : [];

  const handleRefresh = () => {
    refreshNode();
  };

  const currentDate = new Date();
  const refreshButtonTitle = isDefined(lastRefreshedNodeStatusForAllNetworks)
    ? getLastRefreshedTimeText(
        lastRefreshedNodeStatusForAllNetworks,
        currentDate,
      )
    : 'Refresh';

  const renderListRow = (label: string, value: Optional<string | number>) => {
    if (!isDefined(value)) return null;
    return (
      <div className={styles.listRowContainer}>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </div>
    );
  };

  const renderList = (eventListStatus: EventListStatus) => {
    return (
      <div className={styles.listContainer} key={eventListStatus.id}>
        {renderListRow('ID:', shortenWalletAddress(eventListStatus.id))}
        {renderListRow(
          'Blocked Shields:',
          eventListStatus.value.blockedShields,
        )}
        {renderListRow(
          'Pending TransactProofs:',
          eventListStatus.value.pendingTransactProofs,
        )}

        {/* Render each POI event type with its count */}
        <div className={styles.poiEventsContainer}>
          {Object.entries(eventListStatus.value.poiEventLengths).map(
            ([eventType, count]) => (
              <div key={eventType}>{renderListRow(`${eventType}:`, count)}</div>
            ),
          )}
        </div>
      </div>
    );
  };

  // Check if lists are in sync
  const SyncCheck: React.FC<SyncProps> = ({ isInSync, outOfSyncMessage }) => (
    <div className={styles.subtitle}>
      {isInSync ? '✅ Synced ✅' : `❌ ${outOfSyncMessage} ❌`}
    </div>
  );

  const legacyTransactValues = arrayOfEventListStatuses.map(
    status => status.value.poiEventLengths.LegacyTransact,
  );
  const shieldValues = arrayOfEventListStatuses.map(
    status => status.value.poiEventLengths.Shield,
  );

  const isTxIDTreeInSync =
    nodeStatus?.txidStatus?.currentTxidIndex ===
    nodeStatus?.txidStatus?.validatedTxidIndex;

  const isLegacyTransactInSync = new Set(legacyTransactValues).size === 1;
  const isShieldInSync = new Set(shieldValues).size === 1;
  const isListInSync = isLegacyTransactInSync && isShieldInSync;

  let listOutOfSyncMessage = 'Out of Sync';
  if (!isLegacyTransactInSync) {
    listOutOfSyncMessage = '[LegacyTransact] out of sync';
  } else if (!isShieldInSync) {
    listOutOfSyncMessage = '[Shield] out of sync';
  }

  let txOutOfSyncMessage = isTxIDTreeInSync
    ? ''
    : '[Current Tx ID and Validated Tx ID] out of sync';

  return (
    <div className={styles.overallStatusContainer}>
      <div className={styles.titleContainer}>
        <Text className={styles.overallStatusTitle}>Overall Status</Text>
        <Button
          onClick={handleRefresh}
          title={refreshButtonTitle}
          rightIcon={IconType.Refresh}
          iconColor={colors.black}
          disabled={refreshingNode}
          className={styles.refreshButton}
        />
      </div>
      <div className={styles.connectionContainer}>
        <div className={styles.greenDot} />
        <Text>{`Connected to ${nodeIp}`}</Text>
      </div>
      <div className={styles.sectionContainer}>
        <Text className={styles.subtitle}>{'Nodes:'}</Text>
        <SyncCheck
          isInSync={isListInSync}
          outOfSyncMessage={listOutOfSyncMessage}
        />
        {arrayOfEventListStatuses.map(renderList)}
      </div>
      <div className={styles.sectionContainer}>
        <Text className={styles.subtitle}>{'Tx ID Tree:'}</Text>
        <SyncCheck
          isInSync={isTxIDTreeInSync}
          outOfSyncMessage={txOutOfSyncMessage}
        />
        <div className={styles.listContainer}>
          {renderListRow(
            'Current Tx ID:',
            nodeStatus?.txidStatus?.currentTxidIndex,
          )}
          {renderListRow(
            'Validated Tx ID:',
            nodeStatus?.txidStatus?.validatedTxidIndex,
          )}
        </div>
      </div>
    </div>
  );
};
