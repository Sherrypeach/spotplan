import { IconArrowRight, IconChevronDown, IconRoute } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@components/Button';
import { KIND_HELP, SHAPE_HELP, TABLE_TIPS, TEACH_HELP } from '@modules/room/roomHelp';
import { STEPS, type StepKey } from '@modules/steps/steps';
import { useTour } from '@modules/tour/tour';
import { useDocumentTitle } from '@shared/useDocumentTitle';

// One line on what each step is for.
const STEP_SUMMARY: Record<StepKey, string> = {
  students: 'Paste your team list, then sort everyone into 1, 2 or 3.',
  room: 'Draw your walls and furniture, then pick a layout.',
  seats: 'Press Place teammates, then check and swap.',
  chart: 'Print it, project it, or save a picture.',
};

const ROOM_TIPS: { title: string; tips: string[] }[] = [
  { title: 'Drawing your room', tips: SHAPE_HELP },
  { title: 'Desks', tips: KIND_HELP.desks },
  { title: 'Tables', tips: ['Pick a card to put those tables in your room.', ...TABLE_TIPS] },
  { title: 'Lounge seating', tips: KIND_HELP.carpets },
  { title: 'Where you work', tips: TEACH_HELP },
];

const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: 'How do I move a table?',
    answer: 'In Room, open Layout and tap a table to pick it up. Drag it anywhere, or use Turn, Copy and Split. Tap it again, or Done, to put it down.',
  },
  {
    question: 'Can people sit on a rug?',
    answer: 'Yes. In Room, under Layout, pick Lounge seating. Every dot is one person, and you can drag each one where they sit.',
  },
  {
    question: 'How do I undo a change?',
    answer: 'Press Undo above the room drawing, or Ctrl+Z (Cmd+Z on a Mac). It takes back one change at a time.',
  },
  {
    question: 'What if the screen is on another wall?',
    answer: 'In Room, under Shape, pick which wall the screen is on, or drag the screen there. The desks turn to face it.',
  },
  {
    question: 'Is my teammates’ info private?',
    answer: 'Levels, needs and notes never show on the chart, the image or the print. Tap Private info in the top bar to hide them on screen too, like when you’re projecting.',
  },
];

/** How the tool works: the four steps, common questions, and the tour again. */
export function HowToUsePage() {
  useDocumentTitle('How to use');
  const { start, available: tourAvailable } = useTour();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold text-title focus:outline-none">
          How to use
        </h1>
        <p className="mt-1 text-lg text-ink-muted">Four steps. About 10 minutes the first time.</p>
      </header>

      {/* The four steps as one path, joined by a dotted line, like hopping from desk to desk. */}
      <ol className="grid gap-6 md:grid-cols-4 md:gap-3">
        {STEPS.map((step, index) => (
          <li key={step.key} className="relative flex gap-4 md:flex-col md:items-center md:gap-2 md:text-center">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute top-14 bottom-[-1.5rem] left-[1.375rem] border-l-2 border-dashed border-sage-line md:top-[1.375rem] md:right-[-50%] md:bottom-auto md:left-1/2 md:border-t-2 md:border-l-0"
              />
            )}
            <span className={`relative flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${step.stampClass}`} aria-hidden>
              {step.number}
            </span>
            <div className="flex flex-col gap-1 md:items-center">
              <h2 className="text-xl font-semibold">
                <span className="sr-only">Step {step.number}: </span>
                {step.label}
              </h2>
              <p className="text-base text-ink-muted">{STEP_SUMMARY[step.key]}</p>
              <Link to={step.path} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-sage-ink">
                Go to {step.label}
                <IconArrowRight className="size-5" aria-hidden />
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="questions" className="flex flex-col gap-3">
        <h2 id="questions" className="text-2xl font-semibold text-title">
          Common questions
        </h2>
        <div className="flex flex-col gap-2">
          {QUESTIONS.map(({ question, answer }) => (
            <details key={question} className="group rounded-2xl border-2 border-line bg-paper">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-semibold">
                {question}
                <IconChevronDown className="size-5 shrink-0 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <p className="px-4 pb-4 text-base text-ink-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="room-tips" className="flex flex-col gap-3">
        <h2 id="room-tips" className="text-2xl font-semibold text-title">
          Tips for your room
        </h2>
        <div className="flex flex-col gap-2">
          {ROOM_TIPS.map(({ title, tips }) => (
            <details key={title} className="group rounded-2xl border-2 border-line bg-paper">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-semibold">
                {title}
                <IconChevronDown className="size-5 shrink-0 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <ul className="flex list-disc flex-col gap-1.5 px-4 pb-4 pl-9 text-base text-ink-muted">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {tourAvailable && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sage-mist p-4">
          <p className="flex-1 text-base">Want to see it on your own team? The tour shows each step on the real screen.</p>
          <Button onClick={start}>
            <IconRoute className="size-5" aria-hidden />
            Take the tour again
          </Button>
        </div>
      )}
    </section>
  );
}
