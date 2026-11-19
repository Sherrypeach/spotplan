import { useId, type Ref, type TextareaHTMLAttributes } from 'react';

type Variant = 'plain' | 'notebook';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** "notebook": softly ruled paper with a margin line, for lists of names. */
  variant?: Variant;
  ref?: Ref<HTMLTextAreaElement>;
};

const LOOKS: Record<Variant, string> = {
  plain: 'min-h-48 rounded-xl px-4 py-3 leading-relaxed',
  // Lines are 2rem apart and start 0.5rem down, matching the text's line height
  // and top padding; they scroll with the text. Focus shows with the usual ring.
  notebook: 'bg-notebook h-[17rem] resize-none overflow-y-auto rounded-2xl py-2 pr-4 pl-12 leading-8',
};

/** A labelled multi-line input, styled like TextField. */
export function TextArea({ label, hint, error, variant = 'plain', className = '', ref, ...rest }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const border = error ? 'border-danger' : 'border-field-border focus:border-sage';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        className={`w-full border-2 bg-card text-lg ${LOOKS[variant]} ${border}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
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
