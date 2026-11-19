import { IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'success';

type Props = {
  tone?: Tone;
  children: ReactNode;
  /** False when it sits inside a live region of its own that is always there. */
  live?: boolean;
};

const TONES: Record<Tone, { className: string; Icon: typeof IconInfoCircle }> = {
  info: { className: 'bg-step-room/30 text-step-room-ink', Icon: IconInfoCircle },
  success: { className: 'bg-sage-soft text-title', Icon: IconCircleCheck },
};

/** A calm message that isn't an error, read out politely by screen readers. */
export function Notice({ tone = 'info', children, live = true }: Props) {
  const { className, Icon } = TONES[tone];
  return (
    <p role={live ? 'status' : undefined} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-base ${className}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
