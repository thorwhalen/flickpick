/**
 * The command registry and the app's services, built outside React.
 *
 * `createServices(deps)` wires the stores and the commands into one acture registry. `main.tsx`
 * builds it once with the browser dependencies and hands it to React through a context; tests
 * build their own. The registry is plain TypeScript, so a script, a test or a future MCP server
 * can construct and dispatch to it the same way the UI does.
 */
import { createRegistry, type Registry, type Result } from 'acture';
import { buildCommands, type CommandId } from './index';
import type { CommandDeps } from './deps';

export interface Services {
  deps: CommandDeps;
  registry: Registry;
  /** `registry.dispatch` narrowed to our command ids. */
  dispatch: <R = unknown>(id: CommandId, params?: unknown) => Promise<Result<R>>;
}

export function createServices(deps: CommandDeps): Services {
  const registry = createRegistry();
  registry.registerAll(buildCommands(deps));
  return { deps, registry, dispatch: (id, params) => registry.dispatch(id, params) };
}
