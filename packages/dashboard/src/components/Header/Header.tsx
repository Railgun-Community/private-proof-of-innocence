import { Text } from '@components/Text/Text';
import { useDrawerStore, useNodeStore } from '@state/stores';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Header.module.scss';

export const Header = () => {
  const { openDrawer } = useDrawerStore();
  const { nodeIp } = useNodeStore();

  return (
    <div className={styles.headerContainer}>
      <div className={styles.hamburgerMenu} onClick={openDrawer}>
        {renderIcon(IconType.HamburgerMenu)}
        <Text>POI Dashboard</Text>
      </div>
      <div className={styles.ipContainer}>
        <div className={styles.greenDot} />
        <Text>{`Node IP: ${nodeIp}`}</Text>
      </div>
    </div>
  );
};
