import { useNavigate } from 'react-router-dom';
import cn from 'classnames';
import { Button } from '@components/Button/Button';
import { AppRoutes } from '@constants/routes';
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
  rightIcon: IconType;
  route: AppRoutes;
};

export const Drawer = ({ variant, className }: Props) => {
  const navigate = useNavigate();
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

  const goToRoute = (route: string) => () => {
    navigate(route);
    closeDrawer();
  };

  const OPTIONS: DrawerOption[] = [
    {
      title: 'Node Status',
      rightIcon: IconType.ChevronRight,
      route: AppRoutes.NodeStatus,
    },
    {
      title: 'Compare Nodes',
      rightIcon: IconType.ChevronRight,
      route: AppRoutes.CompareNodes,
    },
  ];

  const renderOption = (option: DrawerOption, index: number) => {
    const { title, rightIcon, route } = option;
    return (
      <Button
        key={index}
        title={title}
        rightIcon={rightIcon}
        onClick={goToRoute(route)}
      />
    );
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
