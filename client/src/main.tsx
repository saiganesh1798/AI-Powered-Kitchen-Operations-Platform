import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  // StrictMode might cause double connection in dev, but helps catch React issues
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
