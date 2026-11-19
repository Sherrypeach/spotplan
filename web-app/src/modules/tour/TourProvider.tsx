import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { useClassroom } from '@modules/classroom/classroom';
import { TourContext } from '@modules/tour/tour';
import { Spotlight } from '@modules/tour/Spotlight';
import { TOUR_STEPS } from '@modules/tour/tourSteps';
import { readStored, writeStored } from '@shared/storage';

// Set once the teacher has taken or turned down the tour on this device.
const TOUR_SEEN_KEY = 'seating.tourSeen';

type Props = {
  children: ReactNode;
  /** True while something covers the steps, such as making a new class. */
  paused?: boolean;
};

/** The first-time welcome, and the tour it can start; "Take the tour" starts it again. */
export function TourProvider({ children, paused = false }: Props) {
  const { status } = useClassroom();
  // Also kept here, so a browser that blocks storage still welcomes only once a visit.
  const [seen, setSeen] = useState(() => readStored(TOUR_SEEN_KEY) !== null);
  const [step, setStep] = useState<number | null>(null);
  // Only with a class open, since the tour walks through its pages.
  const ready = status === 'ready' && !paused;
  // A tour cut short (the class closed, or a new one started) doesn't come back later on its own.
  if (!ready && step !== null) setStep(null);

  const finish = useCallback(() => {
    writeStored(TOUR_SEEN_KEY, '1');
    setSeen(true);
    setStep(null);
  }, []);
  const value = useMemo(() => ({ start: () => (ready ? setStep(0) : undefined), available: ready }), [ready]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {ready && !seen && step === null && (
        <Modal
          title="Welcome"
          onClose={finish}
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={finish}>
                I’ll explore
              </Button>
              <Button
                data-autofocus
                onClick={() => {
                  setSeen(true);
                  setStep(0);
                }}
              >
                Show me how
              </Button>
            </div>
          }
        >
          <p className="text-base">Want a 2-minute tour of the four steps?</p>
        </Modal>
      )}
      {ready && step !== null && (
        <Spotlight
          step={TOUR_STEPS[step]}
          index={step}
          total={TOUR_STEPS.length}
          onBack={() => setStep(Math.max(0, step - 1))}
          onNext={() => (step + 1 < TOUR_STEPS.length ? setStep(step + 1) : finish())}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}
