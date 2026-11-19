export type StudentsView = 'steps' | 'onePage';

type Props = {
  view: StudentsView;
  onChange: (view: StudentsView) => void;
};

const OPTIONS: { view: StudentsView; label: string }[] = [
  { view: 'steps', label: 'Step by step' },
  { view: 'onePage', label: 'All on one page' },
];

/** Picks how step 1 is shown: guided parts, or everything as one form. */
export function ViewSwitch({ view, onChange }: Props) {
  return (
    <div role="group" aria-label="How to show this step" className="flex self-start overflow-hidden rounded-full border-2 border-sage-line print:hidden">
      {OPTIONS.map((option) => {
        const on = option.view === view;
        return (
          <button
            key={option.view}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.view)}
            className={`min-h-10 cursor-pointer px-4 text-sm font-medium focus-visible:-outline-offset-3 ${
              on ? 'bg-sage-soft font-semibold text-sage-ink' : 'bg-card text-ink-muted hover:bg-sage-mist'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
