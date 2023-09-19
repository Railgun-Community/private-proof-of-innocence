import { isDefined } from '@railgun-community/shared-models';
import cn from 'classnames';
import { Text } from '@components/Text/Text';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Item.module.scss';

type Props = {
  title: string;
  rightIcon?: IconType;
  onClick?: () => void;
  disabled?: boolean;
};

export const Item = ({ title, rightIcon, onClick, disabled }: Props) => {
  const handleClick = () => {
    if (!isDefined(disabled) || !disabled) {
      onClick?.();
    }
  };

  return (
    <div
      className={cn(styles.itemContainer, {
        [styles.itemContainerClickable]: onClick,
        [styles.itemContainerDisabled]: disabled,
      })}
      onClick={handleClick}
    >
      <Text className={styles.title}>{title}</Text>
      {rightIcon && (
        <div className={styles.rightIcon}>{renderIcon(rightIcon)}</div>
      )}
    </div>
  );
};
