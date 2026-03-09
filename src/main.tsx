import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './themes/theme-retro90s.css';
import './themes/theme-winxp.css';
import './themes/theme-macos9.css';
import './themes/theme-light.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
