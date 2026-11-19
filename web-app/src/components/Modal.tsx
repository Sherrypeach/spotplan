import { IconX } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned at the bottom, so the main button never needs scrolling to. */
  footer: ReactNode;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** A dialog over the page: Escape or the X closes it, and Tab stays inside. */
export function Modal({ title, onClose, children, footer }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Listens on the whole page, so focus can't slip out even when it starts outside
  // the dialog (e.g. after a click on the backdrop).
  useEffect(() => {
    const keepFocusInside = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => !item.hasAttribute('disabled'));
      const first = items[0];
      const last = items[items.length - 1];
      const inside = panel.contains(document.activeElement);
      if (!inside || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => document.removeEventListener('keydown', keepFocusInside);
  }, []);

  // What had focus before the dialog opened, read while rendering, before anything inside takes it.
  const [before] = useState(() => document.activeElement as HTMLElement | null);

  // Focus moves in when it opens (to the button marked data-autofocus, if any)
  // and back to where it was when it closes.
  useEffect(() => {
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    // If what had focus is gone (e.g. the student was just removed), the page's heading takes it.
    return () => {
      const target = before?.isConnected ? before : document.querySelector<HTMLElement>('main h1[tabindex="-1"]');
      target?.focus();
    };
  }, [before]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-card sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b-2 border-line px-6 py-4">
          <h2 id={titleId} className="min-w-0 text-2xl font-semibold break-words">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-hover"
          >
            <IconX className="size-6" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {/* On phones the sheet reaches the bottom edge: stay clear of the home bar. */}
        <footer className="border-t-2 border-line px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">{footer}</footer>
      </div>
    </div>
  );
}
