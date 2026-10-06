/**
 * The edit buffer for text and number fields (tw-frontend-ux `controls.md` § Text and number
 * fields): what the person types is a draft; the value changes only when the draft means a valid
 * value, and leaving the field drops an invalid draft. A refused keystroke never snaps the text back.
 */
import { useState } from 'react';

export function useEditBuffer<T>({
  value,
  format,
  parse,
  onValue,
}: {
  value: T;
  format: (value: T) => string;
  /** The draft's meaning, or `null` when it means no valid value (yet). */
  parse: (draft: string) => T | null;
  onValue: (value: T) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return {
    value: draft ?? format(value),
    invalid: draft !== null && parse(draft) === null,
    onChange: (event: { target: { value: string } }) => {
      const next = event.target.value;
      setDraft(next);
      const parsed = parse(next);
      if (parsed !== null) onValue(parsed);
    },
    onBlur: () => setDraft(null),
  };
}
