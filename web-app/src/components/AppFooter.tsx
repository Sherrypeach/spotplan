/** The line at the bottom of every page: the tool's name, its maker, and the year. */
export function AppFooter() {
  return (
    <footer className="mt-8 pb-2 text-center text-sm text-ink-muted print:hidden">
      SpotPlan · Office seating planner · © {new Date().getFullYear()}
    </footer>
  );
}
