import { IconEye, IconEyeOff, IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useId, useRef, useState } from 'react';

import { usePrivacy } from '@modules/shell/privacy';
import { useDismiss } from '@shared/useDismiss';

/** Says whether private info is showing or hidden, and switches it; the (i) explains what it hides. */
export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  const [explaining, setExplaining] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const Icon = hidden ? IconEyeOff : IconEye;

  // A tap or Tab anywhere else, or Escape, closes the explanation.
  const close = useCallback(() => setExplaining(false), []);
  useDismiss(wrapperRef, explaining, close);

  return (
    // A sage focus ring inside: the bar it sits on uses white rings.
    <div ref={wrapperRef} className="relative [&_:focus-visible]:outline-sage">
      <div
        className={`flex min-h-11 items-stretch overflow-hidden rounded-full border-2 bg-card ${
          hidden ? 'border-sage' : 'border-field-border'
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          title={hidden ? 'Tap to show private info' : 'Tap to hide private info'}
          className={`inline-flex cursor-pointer items-center gap-1 pr-2 pl-2.5 text-2xs font-medium focus-visible:-outline-offset-3 ${
            hidden ? 'bg-title text-card' : 'hover:bg-sage-mist hover:text-sage-ink'
          }`}
        >
          <Icon className="size-4" aria-hidden />
          {/* On a phone the eye alone fits the bar; the words stay for screen readers. */}
          <span className="sr-only sm:not-sr-only">{hidden ? 'Private info hidden' : 'Private info showing'}</span>
        </button>
        <button
          type="button"
          onClick={() => setExplaining((open) => !open)}
          aria-expanded={explaining}
          aria-controls={panelId}
          aria-label="What does this hide?"
          className={`flex w-11 cursor-pointer items-center justify-center border-l-2 border-line hover:bg-sage-mist hover:text-sage-ink focus-visible:-outline-offset-3 ${
            explaining ? 'bg-sage-soft text-title' : 'text-ink-muted'
          }`}
        >
          <IconInfoCircle className="size-3.5" aria-hidden />
        </button>
      </div>
      {explaining && (
        <div id={panelId} className="absolute top-full right-0 z-20 mt-2.5 w-60 rounded-xl border-2 border-sage-line bg-card p-3">
          {/* The little arrow pointing up at the (i). */}
          <span
            className="absolute -top-[6px] right-2.5 size-2.5 rotate-45 border-t-2 border-l-2 border-sage-line bg-card"
            aria-hidden
          />
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-title">
            <IconEyeOff className="size-4" aria-hidden />
            Private info
          </p>
          <p className="text-2xs leading-snug">
            Hides levels, needs, notes and who sits apart, e.g. while your screen is projected. Step 1 is covered
            completely.
          </p>
        </div>
      )}
    </div>
  );
}
