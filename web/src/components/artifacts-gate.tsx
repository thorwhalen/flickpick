/**
 * Shows its children only once the artifact set is loaded: a loading screen meanwhile, and on
 * failure an error that names the URL that failed, with a retry and a pointer to Settings.
 */
import type { ReactNode } from 'react';
import { CMD } from '@/commands/index';
import { RouteLink } from '@/components/route-link';
import { useApp, useArtifacts, useDispatch } from '@/state/hooks';
import { Button } from '@/ui/button';
import { Notice, Skeleton, Spinner } from '@/ui/feedback';

export function ArtifactsGate({ children }: { children: ReactNode }) {
  const status = useApp((s) => s.artifacts.status);
  const source = useApp((s) => s.artifacts.source);
  const error = useApp((s) => s.artifacts.error);
  const artifacts = useArtifacts();
  const dispatch = useDispatch();

  if (status === 'error') {
    return (
      <div className="space-y-3">
        <Notice tone="error">
          <p className="font-medium">Could not load the recommender data from {source}</p>
          <p className="mt-1 break-words">{error}</p>
        </Notice>
        <div className="flex gap-2">
          <Button onClick={() => void dispatch(CMD.load)}>Try again</Button>
          <RouteLink to={{ screen: 'settings', params: {} }} className="inline-flex items-center px-3 text-sm text-primary underline">
            Change the artifact source
          </RouteLink>
        </div>
      </div>
    );
  }
  if (status !== 'ready' || !artifacts) {
    return (
      <div className="space-y-4" aria-busy>
        <Spinner label={source ? `Loading the recommender data from ${source}` : 'Loading your settings'} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3]" />
          ))}
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
