import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import './styles.css';
import { App } from './App';
import {registerPwa} from './services/pwa';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
registerPwa();
