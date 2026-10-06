/**
 * A link to an in-app route. A plain click goes through `navigate` (a pushed history entry that
 * remembers where it came from); a modified click (Ctrl/Cmd/Shift, middle button) is left to the
 * browser, so "open in new tab" keeps working because `href` is the real hash URL.
 */
import type * as React from 'react';
import { formatRoute, navigate, type Route } from '@/route';

export function RouteLink({ to, onClick, ...props }: Omit<React.ComponentProps<'a'>, 'href'> & { to: Route }) {
  return (
    <a
      href={formatRoute(to)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
      }}
      {...props}
    />
  );
}
