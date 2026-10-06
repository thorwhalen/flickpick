/** An on/off switch (`role="switch"`), for boolean settings. */
import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
  ...aria
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn('block size-5 rounded-full bg-background shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')}
      />
    </button>
  );
}
