import { Text } from '@components/Text/Text';
import { shortenWalletAddress } from '@utils/address';
import styles from './List.module.scss';

type Props = {
  listKey: string;
};

export const List = ({ listKey }: Props) => {
  return (
    <div className={styles.listContainer}>
      <Text className={styles.listLabel}>{`List ${shortenWalletAddress(
        listKey,
      )}`}</Text>
    </div>
  );
};
