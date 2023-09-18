import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from '@components/Header/Header';
import { Landing } from '@screens/Landing/Landing';
import styles from './AppNavigator.module.scss';

export const AppNavigator = () => {
  return (
    <div className={styles.appNavigatorContainer}>
      <Header />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};
