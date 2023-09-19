import {
  isDefined,
  NodeStatusForNetwork,
} from '@railgun-community/shared-models';
import { Text } from '@components/Text/Text';
import { shortenWalletAddress } from '@utils/address';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './OverallStatus.module.scss';

const nodeIp = 'http://localhost:3010'; //TODO: Change this later

type Props = {
  nodeStatus: Optional<NodeStatusForNetwork>;
};

export const OverallStatus = ({ nodeStatus }: Props) => {
  const listStatuses = nodeStatus?.listStatuses ?? undefined;

  const arrayOfEventListStatuses = isDefined(listStatuses)
    ? Object.entries(listStatuses).map(([key, value]) => ({
        id: key,
        value,
      }))
    : [];

  const handleRefresh = () => {};

  return (
    <div className={styles.overallStatusContainer}>
      <div className={styles.titleContainer}>
        <Text className={styles.overallStatusTitle}>Overall Status</Text>
        <div className={styles.refreshContainer} onClick={handleRefresh}>
          <Text className={styles.refreshText}>
            {'Last refreshed 3 min ago'}
          </Text>
          <div className={styles.iconContainer}>
            {renderIcon(IconType.Refresh)}
          </div>
        </div>
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
