import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import './index.css';
import './styles/websiteCustomization.css';
import App from './App.jsx';
import { store } from './store/store';
import StartupBoundary from './components/ui/StartupBoundary';

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    // Optional PWA setup must not prevent the main app from starting.
    Promise.resolve().then(() => navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ''}/sw.js`)).then((registration) => {
      const announceUpdate = () => window.dispatchEvent(new CustomEvent('samira:pwa-update', { detail: { registration } }));
      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
        });
      });
    }).catch(() => null);
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StartupBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </StartupBoundary>
  </React.StrictMode>
);
