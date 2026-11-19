import { IconArrowRight, IconListNumbers } from '@tabler/icons-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@components/Button';
import { GAP, HALO, placeBubble, type Box, type Size } from '@modules/tour/placeBubble';
import { STEPS } from '@modules/steps/steps';
import type { TourStep } from '@modules/tour/tourSteps';

type Props = {
  step: TourStep;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};


// The bubble's width, and how far the glow keeps from the screen's edge, in pixels.
const BUBBLE_WIDTH = 340;
const RING = 4;
// How often to look again for a part that isn't on the page yet (it may still be loading).
const LOOK_AGAIN_MS = 250;
// Below Tailwind's md breakpoint the phone step bar shows and the bubble pins to the top or bottom.
const PHONE_QUERY = '(max-width: 767px)';
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// The first mark on the page with this name that's actually showing.
function findTarget(name: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find((element) => element.getBoundingClientRect().width > 0) ?? null;
}

function screenSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * One stop of the tour on the real screen: the part it's about lit up, the
 * rest dimmed and out of reach, and a bubble beside it. Goes to the stop's
 * page first. If the part isn't there (no students yet, say), the bubble
 * shows in the middle and keeps looking for it.
 */
export function Spotlight({ step, index, total, onBack, onNext, onSkip }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const titleId = useId();
  const [box, setBox] = useState<Box | null>(null);
  const [screen, setScreen] = useState(screenSize);
  const [bubbleSize, setBubbleSize] = useState<Size>({ width: BUBBLE_WIDTH, height: 0 });
  const bubble = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const skip = useRef(onSkip);

  const here = location.pathname + location.search;
  const appStep = STEPS.find((candidate) => candidate.key === step.step);
  const band = appStep ? { className: appStep.stampClass, icon: appStep.icon } : { className: 'bg-sage-soft text-sage-ink', icon: IconListNumbers };
  const phone = window.matchMedia?.(PHONE_QUERY).matches ?? false;
  const width = Math.min(BUBBLE_WIDTH, screen.width - GAP * 2);
  const place = phone ? null : placeBubble(box, screen, { width, height: bubbleSize.height });
  // On a phone the bubble pins to the top when the lit-up part is in the bottom half, so it never covers it.
  // The lit-up part's glow stays fully on screen, even for a part against the edge of the screen.
  // The same room on every side, so it stays centered: less than HALO when the part is close to an edge.
  const room =
    box &&
    Math.max(0, Math.min(HALO, box.left - RING, box.top - RING, screen.width - RING - (box.left + box.width), screen.height - RING - (box.top + box.height)));
  const halo = box && room !== null ? { top: box.top - room, left: box.left - room, width: box.width + room * 2, height: box.height + room * 2 } : null;
  const pinTop = phone && box !== null && box.top + box.height / 2 > screen.height / 2;

  useEffect(() => {
    skip.current = onSkip;
  }, [onSkip]);

  // The stop's page replaces the current one, so the browser's Back button leaves the tour's pages behind.
  useEffect(() => {
    if (here !== step.path) navigate(step.path, { replace: true });
  }, [here, step.path, navigate]);

  // Find the part, bring it into view once, and follow it as it moves, resizes or the page scrolls.
  useEffect(() => {
    let found: HTMLElement | null = null;
    let frame = 0;
    let timer = 0;
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setScreen(screenSize());
        if (!found?.isConnected) return;
        const rect = found.getBoundingClientRect();
        setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      });
    };
    const look = () => {
      const target = findTarget(step.target);
      if (target && target !== found) {
        found = target;
        resized?.disconnect();
        resized?.observe(target);
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView?.({ block: 'center', behavior: still ? 'auto' : 'smooth' });
        measure();
      } else if (!target && found) {
        found = null;
        setBox(null);
      }
      timer = window.setTimeout(look, LOOK_AGAIN_MS);
    };
    // A new stop starts from nothing lit, so the last stop's part never lingers.
    setBox(null);
    look();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      resized?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.target, here]);

  useLayoutEffect(() => {
    const element = bubble.current;
    if (element) setBubbleSize({ width: element.offsetWidth, height: element.offsetHeight });
  }, [box, step, screen]);

  useEffect(() => next.current?.focus(), [index]);

  // The page under the tour is out of reach: no Tab into it, no shortcuts like Ctrl+Z.
  // Escape ends the tour. When it ends, focus goes back to the page's heading.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skip.current();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !bubble.current?.contains(event.target as Node)) event.stopImmediatePropagation();
      if (event.key !== 'Tab' || !bubble.current) return;
      const items = [...bubble.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const [first, last] = [items[0], items[items.length - 1]];
      const inside = bubble.current.contains(document.activeElement);
      if (!inside || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    window.addEventListener('keydown', keys, true);
    return () => {
      window.removeEventListener('keydown', keys, true);
      root?.removeAttribute('inert');
      document.querySelector<HTMLElement>('main h1[tabindex="-1"]')?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 print:hidden">
      {/* Clicks outside the bubble do nothing while the tour runs. */}
      <div className={`absolute inset-0 ${box ? '' : 'bg-tour-dim'}`} />
      {box && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-3xl shadow-[0_0_0_9999px_var(--color-tour-dim),0_0_18px_6px_var(--color-tour-glow)] transition-all duration-200 motion-reduce:transition-none"
          style={halo ?? undefined}
        />
      )}
      <div
        ref={bubble}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute flex max-h-[calc(100dvh-1.5rem)] flex-col gap-3 overflow-y-auto rounded-3xl border-2 border-line bg-card p-5 pt-0 shadow-lg ${
          phone
            ? pinTop
              ? 'inset-x-3 top-3'
              : 'inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]'
            : place
              ? ''
              : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
        style={phone ? undefined : place ? { top: place.top, left: place.left, width } : { width }}
      >
        {/* Read out on every step, since the bubble itself stays open. */}
        <p className="sr-only" aria-live="polite">
          Step {index + 1} of {total}. {step.title}. {step.body}
        </p>
        {/* A band in the color of the app step this stop is about, like its stamp in the steps. */}
        <div className={`-mx-5 flex items-center gap-2 px-5 py-3 ${band.className}`} aria-hidden>
          <band.icon className="size-5" />
          <span className="text-sm font-semibold">
            Step {index + 1} of {total}
          </span>
        </div>
        <h2 id={titleId} className="text-xl font-semibold text-title">
          {step.title}
        </h2>
        <p className="text-base" aria-hidden>
          {step.body}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onSkip} className="min-h-11 cursor-pointer rounded-full px-3 text-base font-semibold text-sage-ink hover:bg-sage-mist">
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
            )}
            <Button ref={next} onClick={onNext}>
              {index + 1 < total ? 'Next' : 'Done'}
              {index + 1 < total && <IconArrowRight className="size-5" aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
