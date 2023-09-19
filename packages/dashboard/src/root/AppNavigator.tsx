import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Drawer, SlideDirection } from '@components/Drawer/Drawer';
import { Header } from '@components/Header/Header';
import { Landing } from '@screens/Landing/Landing';
import styles from './AppNavigator.module.scss';

export const AppNavigator = () => {
  const onRequestClose = () => {
    console.log('onRequestClose');
  };

  return (
    <div className={styles.appNavigatorContainer}>
      <Header />
      <Drawer
        variant={SlideDirection.SLIDE_FROM_LEFT}
        onRequestClose={onRequestClose}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};
