import { useState } from 'react';
import { MAX_TAG_NAME } from '@shared/serverLimits';

// The API keeps tag names to 20 characters and never empty.

type Props = {
  index: number;
  name: string;
  onRename: (name: string) => void;
};

/** A tag's name; while it's empty the old name is kept, and comes back if it's left empty. */
export function TagNameInput({ index, name, onRename }: Props) {
  const [draft, setDraft] = useState(name);
  return (
    <input
      aria-label={`Name of color ${index + 1}`}
      maxLength={MAX_TAG_NAME}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value.trim()) onRename(event.target.value.trim());
      }}
      onBlur={() => setDraft(name)}
      className="min-h-11 w-48 rounded-xl border-2 border-field-border bg-card px-3 text-base focus:border-sage"
    />
  );
}
