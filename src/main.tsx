import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registers the pass-through service worker so the browser considers this
// app "installable" (enables Add to Home Screen / fullscreen launch on
// mobile). See public/sw.js — it does not cache anything.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app works fine without it, just without the
      // install prompt.
    });
  });
}
