import cn from 'classnames';
import { Text } from '@components/Text/Text';
import styles from './Drawer.module.scss';

export enum SlideDirection {
  SLIDE_FROM_LEFT = 'SLIDE_FROM_LEFT',
  SLIDE_FROM_RIGHT = 'SLIDE_FROM_RIGHT',
}

type Props = {
  variant: SlideDirection;
  className?: string;
  onRequestClose: () => void;
};

export const Drawer = ({ variant, className, onRequestClose }: Props) => {
  const showDrawer = false;

  if (!showDrawer) {
    return null;
  }

  const getNavStyles = () => {
    if (showDrawer) {
      if (variant === SlideDirection.SLIDE_FROM_LEFT) {
        return cn(styles.slideFromLeft, className);
      }
      if (variant === SlideDirection.SLIDE_FROM_RIGHT) {
        return cn(styles.slideFromRight, className);
      }
    }

    return cn(styles.hideDrawer, className);
  };

  const navClassName = getNavStyles();

  return (
    <>
      <nav className={navClassName}>
        <div className={styles.drawerContentContainer}>
          <Text style={{ color: 'white' }}>Hola man</Text>
          <Text style={{ color: 'white' }}>Hola man</Text>
          <Text style={{ color: 'white' }}>Hola man</Text>
          <Text style={{ color: 'white' }}>Hola man</Text>
          <Text style={{ color: 'white' }}>Hola man</Text>
          <Text style={{ color: 'white' }}>Hola man</Text>
        </div>
      </nav>
      <div className={styles.backdrop} onClick={onRequestClose} />;
    </>
  );
};
