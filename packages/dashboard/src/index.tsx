import { createRoot } from 'react-dom/client';
import { App } from './root/App/App';
// import './scss/index.scss';

const container = document.getElementById('root');
const root = createRoot(container as Element);

root.render(<App />);
