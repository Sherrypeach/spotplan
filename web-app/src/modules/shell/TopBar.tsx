import { IconBook } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import logo from '@assets/brand/logo.png';
import { useClassroom } from '@modules/classroom/classroom';
import { ClassSwitcher } from '@modules/classroom/ClassSwitcher';
import { HOW_TO_USE_PATH } from '@modules/help/paths';
import { AccountMenu } from '@modules/shell/AccountMenu';
import { PrivacyToggle } from '@modules/shell/PrivacyToggle';
import { SaveIndicator } from '@modules/shell/SaveIndicator';

type Props = {
  onNewClass: () => void;
};

/**
 * The green band across the top, always in place: the logo, the open class,
 * whether it's saved, private info, and the teacher's menu.
 */
export function TopBar({ onNewClass }: Props) {
  const { status } = useClassroom();
  // Class, save and privacy only mean something with a class open.
  const ready = status === 'ready';
  return (
    // Brand green edge to edge, with the coral line along its bottom, like the footer.
    // A white focus ring: the usual sage one doesn't show on the green.
    <header className="relative z-20 shrink-0 border-b-4 border-action bg-brand-green shadow-down px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:px-6 lg:px-8 [&_:focus-visible]:outline-white print:hidden">
      {/* Lined up with the page card below, like the footer. */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 sm:gap-4">
        <a href="#content" className="sr-only rounded-lg bg-card px-3 py-2 font-semibold text-sage-ink focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
          Skip to content
        </a>
        <img src={logo} alt="SpotPlan" className="h-9 w-auto sm:h-11" />
        {ready && <span aria-hidden className="hidden h-8 w-px bg-white/30 sm:block" />}
        {ready && <ClassSwitcher onNewClass={onNewClass} onBrand />}
        {/* Two groups: this class (saved, private info), then help and the teacher. */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {ready && <SaveIndicator />}
          {ready && <PrivacyToggle />}
          <span aria-hidden className="hidden h-6 w-px bg-white/30 sm:block" />
          <Link to={HOW_TO_USE_PATH} className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-white hover:bg-white/15">
            <IconBook className="size-5" aria-hidden />
            <span className="sr-only md:not-sr-only">How to use</span>
          </Link>
          <AccountMenu onNewClass={ready ? onNewClass : undefined} />
        </div>
      </div>
    </header>
  );
}
