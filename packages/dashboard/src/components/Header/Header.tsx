import { Text } from '@components/Text/Text';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Header.module.scss';

export const Header = () => {
  const nodeIp = 'localhost:3010'; //TODO: Change this later

  return (
    <div className={styles.headerContainer}>
      {renderIcon(IconType.HamburgerMenu)}
      <Text className={styles.poiDashboardTitle}>POI Dashboard</Text>
      <div className={styles.ipContainer}>
        <div className={styles.greenDot} />
        <Text>{`Node IP: ${nodeIp}`}</Text>
      </div>
    </div>
  );
};
