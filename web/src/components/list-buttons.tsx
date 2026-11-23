/**
 * Watchlist and Not interested for one title: each press acts at once with one Undo (undo-toast)
 * that puts the title back where it was. "Not interested" also takes it out of the recommendations.
 */
import { advise, offerUndo } from 'undo-toast';
import { CMD } from '@/commands/index';
import { useApp, useDispatch } from '@/state/hooks';
import type { ListEntry, ListId } from '@/state/schemas';
import { Button } from '@/ui/button';

const LIST_WORDS: Record<ListId, string> = { watchlist: 'the watchlist', not_interested: 'Not interested' };

/** Put a title on a list (or off it, `null`), with one Undo that restores what it was. */
export function useSetList() {
  const dispatch = useDispatch();
  return async (itemId: string, title: string | undefined, list: ListId | null) => {
    const result = await dispatch<{ before: ListEntry | null }>(CMD.setList, { item_id: itemId, list });
    if (!result.ok) return;
    const before = result.value.before;
    const name = title ? `“${title}”` : 'The title';
    const message = list ? `${name} added to ${LIST_WORDS[list]}` : `${name} taken off ${LIST_WORDS[before?.list ?? 'watchlist']}`;
    offerUndo({
      message,
      advice: advise('remove-item'),
      undo: async () => (await dispatch(CMD.setList, before ? { item_id: itemId, list: before.list, restore: before } : { item_id: itemId, list: null })).ok,
    });
  };
}

export function ListButtons({ itemId, title }: { itemId: string; title?: string }) {
  const entry = useApp((s) => s.lists[itemId]);
  const setList = useSetList();
  const on = (list: ListId) => entry?.list === list;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={on('watchlist') ? 'default' : 'outline'} aria-pressed={on('watchlist')} onClick={() => void setList(itemId, title, on('watchlist') ? null : 'watchlist')}>
        {on('watchlist') ? '★ On watchlist' : '☆ Watchlist'}
      </Button>
      <Button size="sm" variant="ghost" aria-pressed={on('not_interested')} onClick={() => void setList(itemId, title, on('not_interested') ? null : 'not_interested')}>
        {on('not_interested') ? 'Interested again' : 'Not interested'}
      </Button>
    </div>
  );
}
