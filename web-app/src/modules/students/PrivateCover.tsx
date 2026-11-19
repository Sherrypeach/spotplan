import { IconEyeOff } from '@tabler/icons-react';

import { Button } from '@components/Button';
import { usePrivacy } from '@modules/shell/privacy';

/** Shown instead of levels and needs while private info is hidden. */
export function PrivateCover() {
  const { toggle } = usePrivacy();
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-4 rounded-2xl border-3 border-dashed border-line bg-card p-6 text-center">
      <IconEyeOff className="size-12 text-ink-muted" aria-hidden />
      <p className="text-lg">Private info is hidden, so levels, needs, notes and who sits apart don’t show on a projected screen.</p>
      <Button variant="secondary" onClick={toggle}>
        Show private info
      </Button>
    </div>
  );
}
