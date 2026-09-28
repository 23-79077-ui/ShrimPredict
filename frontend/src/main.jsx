import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

// Global helper to apply theme live
export const applyAppTheme = (themeName) => {
  const isDark = themeName === 'dark';
  localStorage.setItem('shrim_theme', isDark ? 'dark' : 'light');
  
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
  
  if (isDark) {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }

  window.dispatchEvent(new CustomEvent('shrim-theme-changed', { detail: { theme: isDark ? 'dark' : 'light' } }));
};

// Initialize Dark/Light theme on startup
const savedTheme = localStorage.getItem('shrim_theme') || 'dark';
applyAppTheme(savedTheme);

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
