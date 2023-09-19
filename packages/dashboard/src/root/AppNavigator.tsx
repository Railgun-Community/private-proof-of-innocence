import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Drawer, SlideDirection } from '@components/Drawer/Drawer';
import { Header } from '@components/Header/Header';
import { NodeStatus } from '@screens/NodeStatus/NodeStatus';
import styles from './AppNavigator.module.scss';

export const AppNavigator = () => {
  return (
    <div className={styles.appNavigatorContainer}>
      <Header />
      <Drawer variant={SlideDirection.SLIDE_FROM_LEFT} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NodeStatus />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};
