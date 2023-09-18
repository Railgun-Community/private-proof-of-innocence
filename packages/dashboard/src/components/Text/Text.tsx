import { isDefined } from '@railgun-community/shared-models';
import { CSSProperties } from 'react';
import cn from 'classnames';
import styles from './Text.module.scss';

export type TextProps = {
  children: React.ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export const Text = ({
  children,
  style,
  onClick,
  onMouseLeave,
  onMouseEnter,
  className,
}: TextProps) => {
  return (
    <div
      className={cn(
        styles.text,
        'text-item no-text-select',
        { [styles.clickable]: isDefined(onClick) },
        className,
      )}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};
