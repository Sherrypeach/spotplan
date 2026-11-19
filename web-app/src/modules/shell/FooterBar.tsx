import { Link } from 'react-router-dom';

import { HOW_TO_USE_PATH } from '@modules/help/paths';
import { useTour } from '@modules/tour/tour';

const LINK = 'cursor-pointer rounded-md px-1 font-semibold text-white hover:bg-white/15';

/** The page's closing band, centered: the brand, then help links and the year, under a coral line. */
export function FooterBar() {
  const { start, available } = useTour();
  return (
    <footer className="shrink-0 shadow-up print:hidden">
      <div className="h-1 bg-action" />
      <div className="flex flex-col items-center gap-1 bg-brand-green px-4 py-3 text-center text-sm text-white">
        <span className="font-semibold tracking-wide uppercase">SpotPlan</span>
        <nav aria-label="Help" className="flex flex-wrap items-center justify-center gap-x-2 text-white/85">
          <Link to={HOW_TO_USE_PATH} className={LINK}>
            How to use
          </Link>
          {available && (
            <>
              <span aria-hidden>·</span>
              <button type="button" onClick={start} className={LINK}>
                Take the tour
              </button>
            </>
          )}
          <span aria-hidden>·</span>
          <span>© {new Date().getFullYear()}</span>
        </nav>
      </div>
    </footer>
  );
}
