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
        {renderListRow('POI Events:', eventListStatus.value.poiEvents)}
      </div>
    );
  };

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
        <Text className={styles.subtitle}>{'Lists:'}</Text>
        {arrayOfEventListStatuses.map(renderList)}
      </div>
      <div className={styles.sectionContainer}>
        <Text className={styles.subtitle}>{'Tx ID Tree:'}</Text>
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
