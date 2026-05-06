import './styles/index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// H1: global error visibility — catch what slips past React's error boundaries.
// Uncaught synchronous errors and unhandled promise rejections both produce
// invisible failures by default. Tagged so Vercel/Sentry log filters can grep.
window.addEventListener('error', (event) => {
  console.error('[Global] Uncaught error', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection', {
    reason: (event.reason as { message?: string })?.message || String(event.reason),
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
