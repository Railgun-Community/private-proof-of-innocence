import {
  isDefined,
  NodeStatusForNetwork,
} from '@railgun-community/shared-models';
import { Item } from '@components/Item/Item';
import { Text } from '@components/Text/Text';
import { useNodeStore } from '@state/stores';
import { shortenWalletAddress } from '@utils/address';
import { getLastRefreshedTimeText } from '@utils/date';
import { IconType } from '@utils/icon-service';
import styles from './OverallStatus.module.scss';

type Props = {
  nodeStatus: Optional<NodeStatusForNetwork>;
};

export const OverallStatus = ({ nodeStatus }: Props) => {
  const {
    getNodeStatusForAllNetworks,
    lastRefreshedNodeStatusForAllNetworks,
    loadingNodeStatusForAllNetworks,
    nodeIp,
  } = useNodeStore();
  const listStatuses = nodeStatus?.listStatuses ?? undefined;

  const arrayOfEventListStatuses = isDefined(listStatuses)
    ? Object.entries(listStatuses).map(([key, value]) => ({
        id: key,
        value,
      }))
    : [];

  const handleRefresh = () => {
    getNodeStatusForAllNetworks();
  };

  const currentDate = new Date();
  const refreshButtonTitle = isDefined(lastRefreshedNodeStatusForAllNetworks)
    ? getLastRefreshedTimeText(
        lastRefreshedNodeStatusForAllNetworks,
        currentDate,
      )
    : 'Refresh';

  return (
    <div className={styles.overallStatusContainer}>
      <div className={styles.titleContainer}>
        <Text className={styles.overallStatusTitle}>Overall Status</Text>
        <Item
          title={refreshButtonTitle}
          rightIcon={IconType.Refresh}
          onClick={handleRefresh}
          disabled={loadingNodeStatusForAllNetworks}
        />
      </div>
      <div className={styles.connectionContainer}>
        <div className={styles.greenDot} />
        <Text>{`Connected to ${nodeIp}`}</Text>
      </div>
      <div className={styles.sectionContainer}>
        <Text className={styles.subtitle}>{'Lists:'}</Text>
        {arrayOfEventListStatuses.map(eventListStatus => (
          <Text key={eventListStatus.id}>
            {`${shortenWalletAddress(eventListStatus.id)}: ${
              eventListStatus.value?.length
            }`}
          </Text>
        ))}
      </div>
      <div className={styles.sectionContainer}>
        <Text className={styles.subtitle}>{'Tx ID Tree:'}</Text>
        {isDefined(nodeStatus?.txidStatus.currentTxidIndex) && (
          <Text>{`Current Tx ID: ${nodeStatus?.txidStatus.currentTxidIndex}`}</Text>
        )}
        {isDefined(nodeStatus?.txidStatus.validatedTxidIndex) && (
          <Text>{`Validated Tx ID: ${nodeStatus?.txidStatus.validatedTxidIndex}`}</Text>
        )}
      </div>
    </div>
  );
};
