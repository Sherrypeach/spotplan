import { useEffect, useState } from 'react';

import { loadLayoutLibrary } from '@modules/layouts/library';
import type { LayoutLibrary } from '@modules/layouts/types';

/** The layout library, loaded the first time the Desks part opens. Null while loading or if it failed. */
export function useLayoutLibrary(): { library: LayoutLibrary | null; failed: boolean } {
  const [library, setLibrary] = useState<LayoutLibrary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadLayoutLibrary().then(
      (loaded) => live && setLibrary(loaded),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);
  return { library, failed };
}
