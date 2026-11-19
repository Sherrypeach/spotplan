import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { PartProgress } from '@components/PartProgress';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import { fillMissingLevels } from '@modules/classroom/rosterEdits';
import { usePrivacy } from '@modules/shell/privacy';
import { StepHeader } from '@modules/steps/StepHeader';
import { STEPS } from '@modules/steps/steps';
import { BasketsPart } from '@modules/students/BasketsPart';
import { ExtrasPart } from '@modules/students/ExtrasPart';
import { NamesPart } from '@modules/students/NamesPart';
import { OnePagePart } from '@modules/students/OnePagePart';
import { PartFooter } from '@modules/students/PartFooter';
import { defaultPart, isPartKey, PARTS, readReturnTo, type PartKey } from '@modules/students/parts';
import { PickLevelPart } from '@modules/students/PickLevelPart';
import { PrivateCover } from '@modules/students/PrivateCover';
import { ViewSwitch, type StudentsView } from '@modules/students/ViewSwitch';
import { readStored, writeStored } from '@shared/storage';

const STEP = STEPS[0];
// Step by step or all on one page, remembered on this device.
const VIEW_KEY = 'seating.studentsView';
const ROOM_PATH = STEPS[1].path;

const TITLES: Record<PartKey, string> = {
  names: 'Add your teammates',
  support: 'Who needs a little extra help?',
  anywhere: 'Who can sit anywhere?',
  check: 'Meet your team',
  extras: 'Anything else?',
};

/** Step 1: names, then the 1s, then the 3s (everyone else is a 2), then the baskets to check. */
export function StudentsStep() {
  const doc = useClassDoc();
  const { update, current } = useClassroom();
  const { hidden } = usePrivacy();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // Names typed but not yet added, kept here so they survive hiding private info;
  // they belong to one class and don't follow the teacher to another.
  const classId = current?.id ?? null;
  const [draft, setDraft] = useState({ classId, text: '' });
  const draftText = draft.classId === classId ? draft.text : '';
  const setDraftText = (text: string | ((latest: string) => string)) =>
    setDraft((current) => {
      const latest = current.classId === classId ? current.text : '';
      return { classId, text: typeof text === 'function' ? text(latest) : text };
    });

  const [view, setViewState] = useState<StudentsView>(() => (readStored(VIEW_KEY) === 'onePage' ? 'onePage' : 'steps'));
  const setView = (next: StudentsView) => {
    writeStored(VIEW_KEY, next);
    setViewState(next);
  };

  const requested = params.get('part');
  const part: PartKey = isPartKey(requested) ? requested : defaultPart(doc.students.length);
  const returnTo = readReturnTo(location.state);
  const returnStep = STEPS.find((step) => step.path === returnTo?.split('?')[0]);

  // Keeps a "back to Seats" handed over by a later step while moving between parts.
  const goTo = (next: PartKey) => setParams({ part: next }, { state: location.state });

  // Leaving "who could sit anywhere" by any way makes everyone not picked a 2, as its hint says.
  const lastPart = useRef(part);
  useEffect(() => {
    if (lastPart.current === 'anywhere' && part !== 'anywhere') update((current) => fillMissingLevels(current, 2));
    lastPart.current = part;
  }, [part, update]);

  const footers: Record<PartKey, () => ReactNode> = {
    names: () => null,
    support: () => <PartFooter onBack={() => goTo('names')} nextLabel="Next: who could sit anywhere?" onNext={() => goTo('anywhere')} />,
    anywhere: () => <PartFooter onBack={() => goTo('support')} nextLabel="Next: check your team" onNext={() => goTo('check')} />,
    check: () =>
      returnTo && returnStep ? (
        <PartFooter onBack={() => goTo('anywhere')} nextLabel={`Back to ${returnStep.label}`} onNext={() => navigate(returnTo)} />
      ) : (
        <PartFooter onBack={() => goTo('anywhere')} nextLabel="Next: anything else?" onNext={() => goTo('extras')} />
      ),
    extras: () =>
      returnTo && returnStep ? (
        <PartFooter onBack={() => goTo('check')} nextLabel={`Back to ${returnStep.label}`} onNext={() => navigate(returnTo)} />
      ) : (
        <PartFooter onBack={() => goTo('check')} nextLabel="Next: Room" onNext={() => navigate(ROOM_PATH)} />
      ),
  };

  const needsStudents = part !== 'names' && doc.students.length === 0;

  const body = (() => {
    if (needsStudents) {
      return <PartFooter nextLabel="Add your teammates first" onNext={() => goTo('names')} />;
    }
    switch (part) {
      case 'names':
        return (
          <NamesPart
            text={draftText}
            onTextChange={setDraftText}
            onAdded={() => goTo('support')}
            onSkip={() => goTo('check')}
          />
        );
      case 'support':
        return <PickLevelPart level={1} hint="Tap a name or drag it into the basket. You can change this later." />;
      case 'anywhere':
        return <PickLevelPart level={3} hint="Tap a name or drag it into the basket. Anyone you don’t pick will be a 2." />;
      case 'check':
        return <BasketsPart />;
      case 'extras':
        return <ExtrasPart />;
    }
  })();

  if (view === 'onePage') {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <StepHeader step={STEP} title="Your team on one page" />
        <ViewSwitch view={view} onChange={setView} />
        {hidden ? (
          <PrivateCover />
        ) : (
          <div className="flex flex-col gap-5 print:hidden">
            <OnePagePart text={draftText} onTextChange={setDraftText} />
            {doc.students.length > 0 &&
              (returnTo && returnStep ? (
                <PartFooter nextLabel={`Back to ${returnStep.label}`} onNext={() => navigate(returnTo)} />
              ) : (
                <PartFooter nextLabel="Next: Room" onNext={() => navigate(ROOM_PATH)} />
              ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-5">
      <StepHeader step={STEP} title={TITLES[part]} />
      {/* Offered once there are names: adding them always comes first. */}
      {part !== 'names' && doc.students.length > 0 && <ViewSwitch view={view} onChange={setView} />}
      <PartProgress parts={PARTS} current={part} onGo={goTo} />
      {hidden ? (
        <PrivateCover />
      ) : (
        // Levels and needs are private: never on paper either.
        <div className="flex flex-col gap-5 print:hidden">
          {body}
          {!needsStudents && footers[part]()}
        </div>
      )}
    </section>
  );
}
