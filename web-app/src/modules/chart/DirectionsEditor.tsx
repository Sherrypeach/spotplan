import { IconArrowDown, IconArrowUp, IconPlus, IconX } from '@tabler/icons-react';
import { useRef, useState } from 'react';

import { Button } from '@components/Button';
import { DEFAULT_DIRECTIONS, MAX_DIRECTION, MAX_DIRECTIONS } from '@modules/chart/chartModel';

type Props = {
  steps: string[];
  onChange: (steps: string[]) => void;
  onDone: () => void;
};

const SMALL_BUTTON = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-hover disabled:cursor-default disabled:opacity-30';

/** The directions for moving, one box per step, to add, remove and reorder. */
export function DirectionsEditor({ steps, onChange, onDone }: Props) {
  const list = useRef<HTMLOListElement>(null);
  // Going back to the starting steps replaces the teacher's own, so it asks once more first.
  const [confirmingReset, setConfirmingReset] = useState(false);
  const set = (index: number, text: string) => onChange(steps.map((step, i) => (i === index ? text : step)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const add = () => {
    onChange([...steps, '']);
    // The new step's box gets the cursor.
    requestAnimationFrame(() => list.current?.querySelector<HTMLTextAreaElement>('li:last-child textarea')?.focus());
  };

  return (
    <div className="flex flex-col gap-2">
      <ol ref={list} className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sm font-semibold text-sage-ink" aria-hidden>
                {index + 1}
              </span>
              <textarea
                aria-label={`Step ${index + 1}`}
                value={step}
                rows={2}
                maxLength={MAX_DIRECTION}
                onChange={(event) => set(index, event.target.value.replace(/\n/g, ' '))}
                className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border-2 border-field-border bg-card px-3 py-2 text-base focus:border-sage"
              />
            </div>
            <div className="flex justify-end gap-1">
              <button type="button" className={SMALL_BUTTON} disabled={index === 0} onClick={() => move(index, -1)}>
                <IconArrowUp className="size-5" aria-hidden />
                <span className="sr-only">Move step {index + 1} up</span>
              </button>
              <button type="button" className={SMALL_BUTTON} disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                <IconArrowDown className="size-5" aria-hidden />
                <span className="sr-only">Move step {index + 1} down</span>
              </button>
              <button type="button" className={SMALL_BUTTON} disabled={steps.length === 1} onClick={() => onChange(steps.filter((_, i) => i !== index))}>
                <IconX className="size-5" aria-hidden />
                <span className="sr-only">Remove step {index + 1}</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={add} disabled={steps.length >= MAX_DIRECTIONS}>
          <IconPlus className="size-5" aria-hidden />
          Add a step
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!confirmingReset) return setConfirmingReset(true);
          onChange(DEFAULT_DIRECTIONS);
          setConfirmingReset(false);
        }}
        onBlur={() => setConfirmingReset(false)}
        className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink"
      >
        {confirmingReset ? 'Tap again to replace your steps' : 'Use the starting steps'}
      </button>
      {steps.length >= MAX_DIRECTIONS && <p className="text-sm text-ink-muted">That’s the most steps a chart can have.</p>}
    </div>
  );
}
