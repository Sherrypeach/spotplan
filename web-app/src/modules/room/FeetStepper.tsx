import { IconMinus, IconPlus } from '@tabler/icons-react';
import { useId, useState } from 'react';

type Props = {
  label: string;
  feet: number;
  min: number;
  max: number;
  onChange: (feet: number) => void;
};

const STEP_BUTTON =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-field-border bg-card text-ink hover:border-sage-line disabled:cursor-default disabled:opacity-40';

/** A size in feet: − and + change it a foot at a time, or type the number. */
export function FeetStepper({ label, feet, min, max, onChange }: Props) {
  const inputId = useId();
  // What's typed, while it's being typed; the saved number otherwise.
  const [typed, setTyped] = useState<string | null>(null);

  const commit = (value: string) => {
    setTyped(null);
    const number = Number(value);
    if (value.trim() && Number.isFinite(number)) onChange(Math.min(max, Math.max(min, Math.round(number))));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-base font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={STEP_BUTTON} disabled={feet <= min} onClick={() => onChange(feet - 1)}>
          <IconMinus className="size-5" aria-hidden />
          <span className="sr-only">{label}: 1 foot less</span>
        </button>
        <div className="flex items-center gap-1.5 rounded-xl border-2 border-field-border bg-card px-3 focus-within:border-sage focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sage">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={typed ?? String(feet)}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit(event.currentTarget.value);
            }}
            className="min-h-11 w-14 bg-transparent text-center text-lg font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-base text-ink-muted">ft</span>
        </div>
        <button type="button" className={STEP_BUTTON} disabled={feet >= max} onClick={() => onChange(feet + 1)}>
          <IconPlus className="size-5" aria-hidden />
          <span className="sr-only">{label}: 1 foot more</span>
        </button>
      </div>
    </div>
  );
}
