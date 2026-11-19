import { IconCheck } from '@tabler/icons-react';
import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-pressed'> & {
  /** Picked: sage, with a check mark. */
  pressed: boolean;
};

/** A rounded choice that turns on and off, the same everywhere in the app. */
export function Chip({ pressed, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-full border-2 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        pressed ? 'border-sage bg-sage-soft text-sage-ink' : 'border-field-border bg-card hover:border-sage-line'
      } ${className}`}
      {...rest}
    >
      {pressed && <IconCheck className="size-4 shrink-0" stroke={2.5} aria-hidden />}
      {children}
    </button>
  );
}
