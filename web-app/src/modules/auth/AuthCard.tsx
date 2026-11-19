import type { ReactNode } from 'react';

import { BrandHeader } from '@components/BrandHeader';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** The branded card that holds every sign-in screen. */
export function AuthCard({ title, subtitle, children }: Props) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-line bg-card">
      <BrandHeader logoClassName="w-36" />
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <header className="text-center">
          <p className="mb-2 text-base font-semibold text-title">Office seating planner</p>
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-base text-ink-muted" aria-live="polite">
              {subtitle}
            </p>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
