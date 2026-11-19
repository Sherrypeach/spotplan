import type { ReactNode } from 'react';

type Props = { locked: boolean; className?: string; children: ReactNode };

/** Turns off every control inside while locked, and shows them as off. */
export function Lockable({ locked, className = '', children }: Props) {
  return (
    <fieldset disabled={locked} className={`min-w-0 [&_:disabled]:cursor-not-allowed [&_:disabled]:opacity-60 ${className}`}>
      {children}
    </fieldset>
  );
}
