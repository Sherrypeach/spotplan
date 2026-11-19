import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { Button } from '@components/Button';
import { LoadingScreen } from '@components/LoadingScreen';
import { useClassroom } from '@modules/classroom/classroom';
import { CreateClassScreen } from '@modules/classroom/CreateClassScreen';
import { HOW_TO_USE_PATH } from '@modules/help/paths';
import { FooterBar } from '@modules/shell/FooterBar';
import { SaveProblems } from '@modules/shell/SaveIndicator';
import { StepNav } from '@modules/shell/StepNav';
import { TopBar } from '@modules/shell/TopBar';
import { TourProvider } from '@modules/tour/TourProvider';
import { useDocumentTitle } from '@shared/useDocumentTitle';

/**
 * A green bar along the top, the four steps under it, the page at full width,
 * and the footer at its end. Printing shows the page alone.
 */
export function ShellLayout() {
  const { status, reload, outdated } = useClassroom();
  const [addingClass, setAddingClass] = useState(false);
  // Going anywhere else (How to use, Back) leaves the new-class screen.
  const { pathname } = useLocation();
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setAddingClass(false);
  }
  const onHelp = pathname === HOW_TO_USE_PATH;
  // Steps and the class screens name the tab themselves; these two states would leave it stale.
  useDocumentTitle(status === 'error' ? 'Can’t open your team' : 'Loading your team', status === 'loading' || status === 'error');

  const page = (() => {
    if (status === 'loading') return <LoadingScreen size="area" />;
    if (status === 'error') {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-card p-8 text-center">
          {outdated ? (
            <>
              <p className="text-lg">This team was saved by a newer version of the app.</p>
              <Button onClick={() => window.location.reload()}>Reload the page</Button>
            </>
          ) : (
            <>
              <p className="text-lg">We couldn’t open your team. Check your connection.</p>
              <Button onClick={reload}>Try again</Button>
            </>
          )}
        </div>
      );
    }
    if (status === 'none' && !onHelp) return <CreateClassScreen first />;
    if (addingClass) {
      const done = () => setAddingClass(false);
      return <CreateClassScreen first={false} onCancel={done} onCreated={done} />;
    }
    return (
      // The page sits on a plain white card so text never runs over the dot pattern.
      <div className="mx-auto max-w-6xl rounded-3xl border-2 border-line bg-card p-4 md:p-6 lg:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <Outlet />
      </div>
    );
  })();

  // The steps show once a class is open and the teacher isn't making a new one.
  const showSteps = status === 'ready' && !addingClass;

  return (
    <TourProvider paused={addingClass}>
      {/* The app fills the screen exactly; only the page area scrolls, never the whole window. */}
      <div className="flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
        {/* Positioned, so hidden screen-reader text inside stays within the scrolling area instead of stretching the window. */}
        <main id="content" tabIndex={-1} className="bg-dots relative flex flex-1 flex-col overflow-y-auto focus:outline-none print:block print:overflow-visible print:bg-none">
          {/* The bar and the steps scroll away with the page, like the footer at its end. */}
          <TopBar onNewClass={() => setAddingClass(true)} />
          {showSteps && <StepNav />}
          {status === 'ready' && (
            <div className="px-4 pt-4 empty:hidden md:px-6 print:hidden">
              <SaveProblems />
            </div>
          )}
          <div className="flex-1 p-4 md:p-6 lg:p-8 print:p-0">{page}</div>
          <FooterBar />
        </main>
      </div>
    </TourProvider>
  );
}
