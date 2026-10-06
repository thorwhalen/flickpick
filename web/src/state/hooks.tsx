/**
 * React access to the services: the stores (read with selectors) and `dispatch` (the only way
 * the UI changes anything). The services are built outside React (`createServices`) and passed
 * in through a context, so tests can render the app over their own.
 */
import type { Artifacts } from 'flickpick';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { Services } from '@/commands/registry';
import type { AppState } from './store';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices: wrap the app in <ServicesProvider>');
  return services;
}

/**
 * Read a slice of the app state. The component re-renders only when the selected value changes
 * (compared with `Object.is`), so select the smallest thing you need, and never build a new
 * object or array inside the selector (that would be "changed" on every render).
 */
export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(useServices().deps.store, selector);
}

/** The loaded artifact set, or null while loading. */
export function useArtifacts(): Artifacts | null {
  return useStore(useServices().deps.data, (s) => s.artifacts);
}

/** `dispatch(commandId, params)`: run a user action. */
export function useDispatch(): Services['dispatch'] {
  return useServices().dispatch;
}
