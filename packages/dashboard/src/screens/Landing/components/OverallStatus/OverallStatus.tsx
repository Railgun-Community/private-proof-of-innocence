import { Text } from '@components/Text/Text';
import styles from './OverallStatus.module.scss';

export const OverallStatus = () => {
  return (
    <div className={styles.overallStatusContainer}>
      <Text className={styles.overallStatusTitle}>Overall Status</Text>
    </div>
  );
};
