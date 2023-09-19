import { Text } from '@components/Text/Text';
import { useDrawerStore } from '@state/stores';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Header.module.scss';

export const Header = () => {
  const { openDrawer } = useDrawerStore(state => state);
  const nodeIp = 'http://localhost:3010'; //TODO: Change this later

  return (
    <div className={styles.headerContainer}>
      <div className={styles.hamburgerMenu} onClick={openDrawer}>
        {renderIcon(IconType.HamburgerMenu)}
      </div>
      <Text className={styles.poiDashboardTitle}>POI Dashboard</Text>
      <div className={styles.ipContainer}>
        <div className={styles.greenDot} />
        <Text>{`Node IP: ${nodeIp}`}</Text>
      </div>
    </div>
  );
};
