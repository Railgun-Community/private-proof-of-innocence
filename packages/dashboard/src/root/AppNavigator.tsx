import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Drawer, SlideDirection } from '@components/Drawer/Drawer';
import { Header } from '@components/Header/Header';
import { AppRoutes } from '@constants/routes';
import { CompareNodes } from '@screens/CompareNodes/CompareNodes';
import { NodeStatus } from '@screens/NodeStatus/NodeStatus';
import styles from './AppNavigator.module.scss';

export const AppNavigator = () => {
  return (
    <div className={styles.appNavigatorContainer}>
      <BrowserRouter basename="/dashboard">
        <Header />
        <Drawer variant={SlideDirection.SLIDE_FROM_LEFT} />
        <Routes>
          <Route path={AppRoutes.NodeStatus} element={<NodeStatus />} />
          <Route path={AppRoutes.CompareNodes} element={<CompareNodes />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};
