import cn from 'classnames';
import { Item } from '@components/Item/Item';
import { useDrawerStore } from '@state/stores';
import { IconType } from '@utils/icon-service';
import styles from './Drawer.module.scss';

export enum SlideDirection {
  SLIDE_FROM_LEFT = 'SLIDE_FROM_LEFT',
  SLIDE_FROM_RIGHT = 'SLIDE_FROM_RIGHT',
}

type Props = {
  variant: SlideDirection;
  className?: string;
};

type DrawerOption = {
  title: string;
  rightIcon?: IconType;
  onClick?: () => void;
};

export const Drawer = ({ variant, className }: Props) => {
  const { isOpen: showDrawer, closeDrawer } = useDrawerStore();

  const getNavStyles = () => {
    if (showDrawer) {
      if (variant === SlideDirection.SLIDE_FROM_LEFT) {
        return cn(styles.slideFromLeft, className);
      }
      if (variant === SlideDirection.SLIDE_FROM_RIGHT) {
        return cn(styles.slideFromRight, className);
      }
    }

    return cn(styles.slideFromLeft, styles.hideDrawer, className);
  };

  const navClassName = getNavStyles();

  const OPTIONS: DrawerOption[] = [
    {
      title: 'Option 1',
      rightIcon: IconType.ChevronRight,
      onClick: () => {},
    },
    {
      title: 'Option 2',
      rightIcon: IconType.ChevronRight,
      onClick: () => {},
    },
    {
      title: 'Option 3',
      rightIcon: IconType.ChevronRight,
      onClick: () => {},
    },
  ];

  const renderOption = (option: DrawerOption, index: number) => {
    return <Item key={index} {...option} />;
  };

  return (
    <>
      <nav className={navClassName}>
        <div className={styles.drawerContentContainer}>
          {OPTIONS.map(renderOption)}
        </div>
      </nav>
      {showDrawer && <div className={styles.backdrop} onClick={closeDrawer} />}
    </>
  );
};
