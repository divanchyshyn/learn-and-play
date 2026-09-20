import { createRoot } from 'react-dom/client';
import '../../styles/base.css';
import '../../shared/game-header.css'; // shared header styles load first so the game can override
import './style.css';
import { Tierhopp } from './Tierhopp.jsx';

createRoot(document.getElementById('root')).render(<Tierhopp />);
