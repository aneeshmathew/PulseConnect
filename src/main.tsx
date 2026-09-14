import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useUIStore } from './store';

// Apply dark mode class to <html> immediately on load (before first render)
// so there's no flash of unstyled content
const { darkMode } = useUIStore.getState();
document.documentElement.classList.toggle('dark', darkMode);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
