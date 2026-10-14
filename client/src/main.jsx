/**
 * main.jsx — React app entry point
 *
 * This is the first file React loads. It renders the <App /> component
 * into the #root div in index.html. We import our design tokens and
 * global styles here so they apply to the entire app.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Design tokens first, then global reset — order matters in CSS
import './styles/tokens.css';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
