import { IconCheck } from '@tabler/icons-react';

import type { Step } from '@modules/steps/steps';

type Props = {
  step: Step;
  done: boolean;
};

/** The step's colored circle: its icon, or a check once the step is done. */
export function StepStamp({ step, done }: Props) {
  const Glyph = done ? IconCheck : step.icon;
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${step.stampClass}`} aria-hidden>
      <Glyph className="size-5" stroke={2.25} />
    </span>
  );
}
