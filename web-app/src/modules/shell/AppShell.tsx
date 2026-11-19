import { useMemo, useState } from 'react';

import { useAuth } from '@context/auth';
import { ClassroomProvider } from '@modules/classroom/ClassroomProvider';
import { PrivacyContext } from '@modules/shell/privacy';
import { ShellLayout } from '@modules/shell/ShellLayout';
import { readStored, writeStored } from '@shared/storage';

// Remembered on this device, so a projected screen stays private after a reload.
const HIDDEN_KEY = 'seating.privateHidden';


/** Signed-in area: the open class and the "Hide private info" switch are shared by every step. */
export function AppShell() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => readStored(HIDDEN_KEY) === '1');
  const privacy = useMemo(
    () => ({
      hidden,
      toggle: () => {
        writeStored(HIDDEN_KEY, hidden ? '0' : '1');
        setHidden(!hidden);
      },
    }),
    [hidden],
  );

  return (
    <PrivacyContext.Provider value={privacy}>
      {/* A different teacher gets a fresh provider: nothing of the last one's class carries over. */}
      <ClassroomProvider key={user?.id}>
        <ShellLayout />
      </ClassroomProvider>
    </PrivacyContext.Provider>
  );
}
