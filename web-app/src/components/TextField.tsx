import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Help shown under the field before anything goes wrong. */
  hint?: string;
  error?: string;
  /** A control inside the field's right edge, e.g. a "Show" button. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

const INPUT_BASE = 'min-h-12 w-full rounded-xl border-2 bg-card px-4 text-lg transition placeholder:text-ink-muted/75';

function inputClass(hasError: boolean, hasTrailing: boolean): string {
  const border = hasError ? 'border-danger' : 'border-field-border focus:border-sage';
  const padding = hasTrailing ? 'pr-24' : '';
  return `${INPUT_BASE} ${border} ${padding}`;
}

/** A labelled text input with a large tap target, an optional hint and an error tied to it. */
export function TextField({ label, hint, error, trailing, className = '', ref, ...rest }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          className={inputClass(Boolean(error), Boolean(trailing))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className="text-base text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-base text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
