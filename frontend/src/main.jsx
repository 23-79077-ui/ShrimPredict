import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import {
  applyAppTheme,
  getEffectiveTheme,
  getThemePreference,
  getTimeBasedTheme,
  resetThemeToAuto,
  setManualTheme,
  initThemeSystem
} from './utils/theme';

export {
  applyAppTheme,
  getEffectiveTheme,
  getThemePreference,
  getTimeBasedTheme,
  resetThemeToAuto,
  setManualTheme
};

// Initialize theme on app startup (auto 6am-6pm light, 6pm-6am dark unless manually chosen)
initThemeSystem();

const container = document.getElementById('root');
let root = container._reactRootContainer;
if (!root) {
  root = ReactDOM.createRoot(container);
  container._reactRootContainer = root;
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
