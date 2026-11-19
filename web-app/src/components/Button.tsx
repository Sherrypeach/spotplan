import { IconLoader2 } from '@tabler/icons-react';
import type { ButtonHTMLAttributes, MouseEvent, Ref } from 'react';

// quiet: a bold sage text button, for actions next to the one main button.
type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

const BASE =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition active:translate-y-px motion-reduce:active:translate-y-0 aria-disabled:cursor-wait aria-disabled:opacity-70 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-action px-7 text-lg text-action-on hover:bg-action-hover',
  secondary: 'border-2 border-sage-line bg-card px-5 text-base text-sage-ink hover:bg-sage-mist',
  quiet: 'px-3 text-base text-sage-ink hover:bg-sage-mist',
  danger: 'bg-danger px-5 text-base text-card hover:opacity-90',
};

/** A big peach pill for the main action, outlined for the others, red for one that can't easily be taken back. */
export function Button({
  variant = 'primary',
  loading = false,
  type = 'button',
  className = '',
  onClick,
  children,
  ...rest
}: Props) {
  // While loading the button stays focusable (a disabled button drops focus),
  // it just ignores clicks and Enter.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading && <IconLoader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  );
}
