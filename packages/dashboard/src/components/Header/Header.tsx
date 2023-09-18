import { Text } from '@components/Text/Text';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Header.module.scss';

export const Header = () => {
  return (
    <div className={styles.headerContainer}>
      {renderIcon(IconType.HamburgerMenu)}
      <div className={styles.ipContainer}>
        <Text>IP</Text>
      </div>
    </div>
  );
};
