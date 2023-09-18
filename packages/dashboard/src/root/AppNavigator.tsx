import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Landing } from '@screens/Landing/Landing';

export const AppNavigator = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* <Route path="residential" element={<ResidentialPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
};
