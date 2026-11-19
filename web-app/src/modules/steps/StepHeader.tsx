import { IconUsers } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { TipBox } from '@components/TipBox';
import { STEPS, type Step } from '@modules/steps/steps';
import { CHECK_PART_PATH } from '@modules/students/parts';
import { useDocumentTitle } from '@shared/useDocumentTitle';

type Props = {
  step: Step;
  /** Overrides the step's own title, e.g. for a sub-step. */
  title?: string;
  /** Keeps the tip showing, with no Hide. */
  fixedTip?: boolean;
};

/** The step's numbered stamp, its title and its tip; save and privacy sit in the top bar. */
export function StepHeader({ step, title = step.title, fixedTip = false }: Props) {
  useDocumentTitle(step.label);
  const navigate = useNavigate();
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A new step or sub-step puts keyboard and screen-reader focus on its title.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step.key, title]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* The step's own stamp is its number, in its color. */}
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${step.stampClass}`} aria-hidden>
            {step.number}
          </span>
          <p className="sr-only">
            Step {step.number} of {STEPS.length}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold text-title focus:outline-none">
            {title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {/* From any later step, a way back to the levels that lands back here (same part) afterwards. */}
          {step.key !== 'students' && (
            <button
              type="button"
              onClick={() => navigate(CHECK_PART_PATH, { state: { returnTo: location.pathname + location.search } })}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border-2 border-sage-line bg-card px-3 text-sm font-medium text-sage-ink hover:bg-sage-mist"
            >
              <IconUsers className="size-3.5" aria-hidden />
              Teammates’ levels
            </button>
          )}
        </div>
      </header>
      <div className="print:hidden">
        <TipBox tip={step.tip} fixed={fixedTip} accentClass={step.accentClass} />
      </div>
    </div>
  );
}
