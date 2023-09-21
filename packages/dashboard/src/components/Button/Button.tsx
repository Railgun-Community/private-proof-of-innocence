import { isDefined } from '@railgun-community/shared-models';
import cn from 'classnames';
import { Text } from '@components/Text/Text';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Button.module.scss';

type Props = {
  title: string;
  rightIcon?: IconType;
  onClick?: () => void;
  disabled?: boolean;
};

export const Button = ({ title, rightIcon, onClick, disabled }: Props) => {
  const handleClick = () => {
    if (!isDefined(disabled) || !disabled) {
      onClick?.();
    }
  };

  return (
    <div
      className={cn(styles.buttonContainer, {
        [styles.buttonContainerClickable]: onClick,
        [styles.buttonContainerDisabled]: disabled,
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
