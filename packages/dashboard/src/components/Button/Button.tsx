import { isDefined } from '@railgun-community/shared-models';
import cn from 'classnames';
import { Spinner } from '@components/Spinner/Spinner';
import { Text } from '@components/Text/Text';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Button.module.scss';

type Props = {
  title: string;
  rightIcon?: IconType;
  onClick?: () => void;
  disabled?: boolean;
  iconSize?: number;
  iconColor?: string;
  loading?: boolean;
  className?: string;
};

export const Button = ({
  title,
  rightIcon,
  onClick,
  iconSize,
  iconColor,
  disabled = false,
  loading = false,
  className,
}: Props) => {
  const disabledOrLoading = disabled || loading;

  const handleClick = () => {
    if (!isDefined(disabledOrLoading) || !disabledOrLoading) {
      onClick?.();
    }
  };

  return (
    <div
      className={cn(
        styles.buttonContainer,
        {
          [styles.buttonContainerClickable]: onClick,
          [styles.buttonContainerDisabled]: disabledOrLoading,
        },
        className,
      )}
      onClick={handleClick}
    >
      {loading ? (
        <div className={styles.spinnerContainer}>
          <Spinner size={15} />
        </div>
      ) : (
        <>
          <Text className={styles.title}>{title}</Text>
          {rightIcon && (
            <div className={styles.rightIcon}>
              {renderIcon(rightIcon, iconSize, iconColor)}
            </div>
          )}
        </>
      )}
    </div>
  );
};
