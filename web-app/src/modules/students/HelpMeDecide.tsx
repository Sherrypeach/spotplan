import { useState } from 'react';

import { Button } from '@components/Button';
import { HELP_QUESTIONS, levelName, type HelpAnswer } from '@modules/classroom/levels';
import type { Level } from '@modules/seating/engine/types';
import { LevelStamp } from '@modules/students/LevelStamp';

type Props = {
  name: string;
  onUse: (level: Level) => void;
  onClose: () => void;
};

/** Yes or no questions, one at a time, until one of them settles the level. */
export function HelpMeDecide({ name, onUse, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Exclude<HelpAnswer, 'next'> | null>(null);
  const question = HELP_QUESTIONS[step];
  const answer = (choice: HelpAnswer) => (choice === 'next' ? setStep(step + 1) : setResult(choice));

  return (
    <section aria-label="Help me decide" aria-live="polite" className="flex flex-col gap-3 rounded-2xl border-2 border-sage-line bg-sage-mist p-4">
      {result ? (
        <>
          <p className="flex items-center gap-2 text-base font-semibold">
            <LevelStamp level={result.level} />
            {levelName(result.level)}
          </p>
          <p className="text-base">
            {name} {result.why}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              autoFocus
              onClick={() => {
                onUse(result.level);
                onClose();
              }}
            >
              Use level {result.level}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              I’ll pick myself
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-ink-muted">
            Question {step + 1} of {HELP_QUESTIONS.length}
          </p>
          <p className="text-base font-semibold">{question.ask(name)}</p>
          <p className="text-sm text-ink-muted">{question.examples}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => answer(question.yes)}>
              Yes
            </Button>
            <Button variant="secondary" onClick={() => answer(question.no)}>
              No
            </Button>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
