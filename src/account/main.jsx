import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './style.css';
import { AccountPage } from './AccountPage.jsx';

createRoot(document.getElementById('root')).render(<AccountPage />);
