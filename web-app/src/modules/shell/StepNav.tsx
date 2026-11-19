import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';

import { useClassroom } from '@modules/classroom/classroom';
import { StepStamp } from '@modules/shell/StepStamp';
import { isStepDone, STEPS } from '@modules/steps/steps';

/**
 * The four steps in a row, joined by a line that turns green once the step
 * before it is done. The current one is bold on a soft sage tint; finished
 * ones show a check. On phones only the circles show.
 */
export function StepNav() {
  const { doc } = useClassroom();
  const done = STEPS.map((step) => doc !== null && isStepDone(step.key, doc));

  return (
    <nav aria-label="Steps" className="px-3 pt-3 print:hidden">
      <ol data-tour="steps" className="mx-auto flex max-w-3xl items-center">
        {STEPS.map((step, index) => (
          <Fragment key={step.key}>
            {index > 0 && <li aria-hidden className={`mx-1 h-[3px] min-w-3 flex-1 rounded-full sm:mx-3 ${done[index - 1] ? 'bg-sage' : 'bg-line'}`} />}
            <li>
              <NavLink
                to={step.path}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-full p-1 text-base md:pr-4 ${
                    isActive ? 'bg-sage-soft font-semibold text-sage-ink' : 'font-medium text-ink-muted hover:bg-hover'
                  }`
                }
              >
                <StepStamp step={step} done={done[index]} />
                <span className="sr-only md:not-sr-only">
                  <span className="sr-only">{step.number} · </span>
                  {step.label}
                  {done[index] && <span className="sr-only"> (done)</span>}
                </span>
              </NavLink>
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
