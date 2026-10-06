/**
 * Entry point: build the services (stores, providers, command registry) once, outside React,
 * and render the app over them.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { browserDeps } from './commands/deps';
import { createServices } from './commands/registry';
import { ServicesProvider } from './state/hooks';
import './index.css';

const services = createServices(browserDeps());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
