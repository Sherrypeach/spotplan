import { useEffect } from 'react';

const APP_NAME = 'SpotPlan';

/**
 * Names the browser tab after the page, so screen readers announce where the
 * teacher is. `active` false leaves the title to whatever else is showing.
 */
export function useDocumentTitle(page: string, active = true): void {
  useEffect(() => {
    if (active) document.title = `${page} · ${APP_NAME}`;
  }, [page, active]);
}
