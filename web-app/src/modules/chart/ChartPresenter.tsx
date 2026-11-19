import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import { shownDirections } from '@modules/chart/chartModel';
import { ChartSheet } from '@modules/chart/ChartSheet';
import { canFullscreen } from '@modules/chart/chartExport';
import { CHART_PALETTES } from '@modules/chart/chartStyles';
import type { ClassroomDocument } from '@modules/classroom/document';

type Props = {
  doc: ClassroomDocument;
  onClose: () => void;
};

// The buttons and pointer fade out after this long without a move, so the class sees only the chart.
const IDLE_MS = 3000;

/**
 * The chart on the classroom screen: the moving-day steps big enough to read
 * from the back first (when the chart has them), then the room alone, filling
 * the screen. Full screen where the browser can; covering the page where it
 * can't (iPhone).
 */
export function ChartPresenter({ doc, onClose }: Props) {
  const colors = CHART_PALETTES[doc.chart.style];
  const steps = doc.chart.showDirections ? shownDirections(doc.chart) : [];
  const [screen, setScreen] = useState<'directions' | 'room'>(steps.length > 0 ? 'directions' : 'room');
  const [idle, setIdle] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const element = stage.current;
    element?.focus();
    if (canFullscreen()) element?.requestFullscreen().catch(() => {});
    // Leaving full screen (Esc, or the browser's own controls) ends presenting.
    const onChange = () => !document.fullscreenElement && close.current();
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    const onKey = (event: KeyboardEvent) => {
      wake();
      if (event.key === 'Escape') close.current();
      if ((event.key === 'ArrowRight' || event.key === ' ') && steps.length > 0) setScreen('room');
      if (event.key === 'ArrowLeft' && steps.length > 0) setScreen('directions');
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', onKey);
    };
  }, [steps.length]);

  const button = 'flex min-h-11 cursor-pointer items-center gap-1 rounded-full border-2 px-4 text-base font-semibold';
  const buttonColors = { background: colors.CARD, borderColor: colors.CARD_EDGE, color: colors.INK };

  return (
    <div
      ref={stage}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Presenting the seating chart. Press Esc or Done to go back."
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] focus:outline-none md:p-8 ${idle ? 'cursor-none' : ''}`}
      style={{ background: colors.PAPER }}
    >
      {screen === 'directions' ? (
        <section className="flex w-full max-w-6xl flex-col gap-[3vh]" aria-label="Moving day">
          <h2 className="font-semibold" style={{ color: colors.TITLE, fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}>
            Moving day
          </h2>
          <ol className="flex flex-col gap-[2.2vh]">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start gap-[1.5vw]" style={{ color: colors.INK, fontSize: 'clamp(1.25rem, 2.6vw, 2.75rem)', lineHeight: 1.3 }}>
                <span
                  className="flex shrink-0 items-center justify-center rounded-full font-semibold"
                  style={{ width: '1.6em', height: '1.6em', background: colors.STAMPS[index % colors.STAMPS.length], color: colors.STAMP_INK, border: colors.STAMP_EDGE === 'none' ? undefined : `2px solid ${colors.STAMP_EDGE}` }}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="pt-[0.15em]">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <ChartSheet doc={doc} variant="room" fit />
        </div>
      )}
      <div className={`absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex gap-2 transition-opacity md:right-6 ${idle ? 'opacity-0' : 'opacity-100'}`}>
        {steps.length > 0 &&
          (screen === 'directions' ? (
            <button type="button" className={button} style={buttonColors} onClick={() => setScreen('room')}>
              Show the seats
              <IconArrowRight className="size-5" aria-hidden />
            </button>
          ) : (
            <button type="button" className={button} style={buttonColors} onClick={() => setScreen('directions')}>
              <IconArrowLeft className="size-5" aria-hidden />
              Moving day
            </button>
          ))}
        <button type="button" className={button} style={buttonColors} onClick={onClose}>
          <IconX className="size-5" aria-hidden />
          Done
        </button>
      </div>
    </div>
  );
}
