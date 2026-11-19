import { Link, type LinkProps } from 'react-router-dom';

/** An in-app text link with a 44px tall tap area. */
export function TextLink({ className = '', ...rest }: LinkProps) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center px-1 text-base font-semibold text-sage-ink rounded-lg hover:bg-hover ${className}`}
      {...rest}
    />
  );
}
