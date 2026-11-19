type Props<K extends string> = {
  parts: readonly { key: K; label: string }[];
  current: K;
  onGo: (part: K) => void;
};

/** A step's parts as pills; any of them can be opened at any time. */
export function PartProgress<K extends string>({ parts, current, onGo }: Props<K>) {
  return (
    <nav aria-label="Parts of this step" className="print:hidden">
      {/* One row that scrolls sideways on phones, rather than wrapping into a jumble. */}
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {parts.map((part, index) => {
          const isCurrent = part.key === current;
          return (
            <li key={part.key} className="shrink-0">
              <button
                type="button"
                onClick={() => onGo(part.key)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`min-h-11 cursor-pointer rounded-full px-4 text-base font-medium whitespace-nowrap ${
                  isCurrent ? 'bg-sage-soft font-semibold text-sage-ink' : 'border-2 border-line bg-card text-ink-muted hover:border-sage-line'
                }`}
              >
                {index + 1} · {part.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
