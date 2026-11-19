import { Chip } from '@components/Chip';
import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@components/Button';
import { DESKS_PART_PATH, SHAPE_PART_PATH } from '@modules/room/parts';
import { CHECK_PART_PATH } from '@modules/students/parts';
import type { CheckItem, Feedback, SwapSuggestion, Tier } from '@modules/seating/engine';

type Props = {
  items: CheckItem[];
  checkedOff: Set<string>;
  sentence: (item: CheckItem) => string;
  nameOf: (studentId: string) => string;
  selected: string | null;
  onSelect: (key: string | null) => void;
  suggestions: SwapSuggestion[];
  onSwap: (suggestion: SwapSuggestion) => void;
  onGotIt: (key: string) => void;
  feedback: Feedback;
  onFeedback: (key: keyof Feedback) => void;
  busy: boolean;
  /** Makes every safe swap it can find. */
  onFixAll: () => void;
  /** What the last "Fix what I can" did. */
  fixedMessage: string;
  /** Shows the layouts where every seat faces the front. */
  onFrontLayouts: () => void;
};

const TIERS: { tier: Tier; title: string; tone: string; summary: string; chip: string }[] = [
  { tier: 'attention', title: 'Needs attention', tone: 'text-danger', summary: 'to fix', chip: 'bg-danger/10 text-danger' },
  { tier: 'look', title: 'Worth a look', tone: 'text-ink', summary: 'to look at', chip: 'bg-level-2/30 text-ink' },
  { tier: 'nice', title: 'Nice to have, not met', tone: 'text-ink-muted', summary: 'nice to have', chip: 'bg-sage-soft text-sage-ink' },
];

// Problems with the room itself: the layout or the room fixes them, not a swap.
const ROOM_KINDS: CheckItem['kind'][] = ['more-students-than-seats', 'too-few-front-seats', 'front-seats-short-for-nice', 'no-door', 'no-level'];

// Where each of those gets fixed.
const ROOM_KIND_LINKS: Record<string, { path: string; label: string }> = {
  'no-door': { path: SHAPE_PART_PATH, label: 'Add a door →' },
  'no-level': { path: CHECK_PART_PATH, label: 'Give them a level →' },
  'more-students-than-seats': { path: DESKS_PART_PATH, label: 'Change your layout →' },
};

// About seats facing the board, where another layout may help.
function needsFrontSeats(item: CheckItem): boolean {
  return item.kind === 'too-few-front-seats' || item.kind === 'front-seats-short-for-nice' || item.need === 'face-front';
}

function FrontLayoutsLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink">
      See layouts with more front-facing seats →
    </button>
  );
}

const FEEDBACK: { key: keyof Feedback; label: string }[] = [
  { key: 'spreadOutOnes', label: 'Spread out the 1s more' },
  { key: 'onesCloserToMe', label: 'Keep 1s closer to me' },
  { key: 'fewerOnesPerTable', label: 'Fewer 1s at each table' },
];

const STRENGTH = ['', ' · on', ' · stronger'];

/** What to look at, in plain sentences, with swaps that fix it. */
export function CheckPart({ items, checkedOff, sentence, nameOf, selected, onSelect, suggestions, onSwap, onGotIt, feedback, onFeedback, busy, onFixAll, fixedMessage, onFrontLayouts }: Props) {
  const [showChecked, setShowChecked] = useState(false);
  const open = items.filter((item) => !checkedOff.has(item.key));
  const done = items.filter((item) => checkedOff.has(item.key));
  const selectedItem = open.find((item) => item.key === selected);

  return (
    <div className="flex flex-col gap-4">
      {open.length === 0 ? (
        <p className="rounded-xl bg-sage-soft px-3 py-2 text-base font-medium text-sage-ink">Nothing to fix. Nice seating!</p>
      ) : (
        <p className="flex flex-wrap gap-2 text-sm font-medium" aria-label="Summary">
          {TIERS.map(({ tier, summary, chip }) => {
            const n = open.filter((item) => item.tier === tier).length;
            return n > 0 ? (
              <span key={tier} className={`rounded-full px-3 py-1 ${chip}`}>
                {n} {summary}
              </span>
            ) : null;
          })}
        </p>
      )}
      {open.some((item) => !ROOM_KINDS.includes(item.kind)) && (
        <Button variant="secondary" className="self-start" onClick={onFixAll} loading={busy}>
          Fix what I can
        </Button>
      )}
      <p className="text-sm text-ink-muted empty:hidden" role="status">
        {fixedMessage}
      </p>
      {TIERS.map(({ tier, title, tone }) => {
        const inTier = open.filter((item) => item.tier === tier);
        if (inTier.length === 0) return null;
        const list = (
          <ul className="flex flex-col gap-2">
            {inTier.map((item) => {
              const isOpen = item.key === selected;
              return (
                <li key={item.key} className={`rounded-xl border-2 p-2 ${isOpen ? 'border-sage bg-sage-mist' : 'border-line bg-card'}`}>
                  <div className="flex items-start gap-2">
                    <button type="button" aria-expanded={isOpen} onClick={() => onSelect(isOpen ? null : item.key)} className="min-w-0 flex-1 cursor-pointer text-left text-sm">
                      {sentence(item)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onGotIt(item.key)}
                      className="shrink-0 cursor-pointer rounded-lg border-2 border-sage-line px-2 py-1 text-xs font-semibold text-sage-ink hover:bg-sage-mist"
                    >
                      Got it
                    </button>
                  </div>
                  {isOpen && selectedItem && (
                    <div className="mt-2 flex flex-col gap-2">
                      {ROOM_KINDS.includes(item.kind) ? (
                        needsFrontSeats(item) ? (
                          <FrontLayoutsLink onClick={onFrontLayouts} />
                        ) : (
                          <Link to={ROOM_KIND_LINKS[item.kind].path} className="inline-flex min-h-11 items-center text-base font-semibold text-sage-ink">
                            {ROOM_KIND_LINKS[item.kind].label}
                          </Link>
                        )
                      ) : (
                        <>
                          {suggestions.length === 0 ? (
                            <p className="text-sm text-ink-muted">No single swap fixes this without causing something worse.</p>
                          ) : (
                            suggestions.map((suggestion) => (
                              <div key={suggestion.seatIds.join('-')} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2 py-1.5 text-sm">
                                <span>
                                  {suggestion.studentIds.length === 2 ? 'Swap' : 'Move'} {suggestion.studentIds.map(nameOf).join(' and ')}
                                  <span className="block text-xs text-ink-muted">
                                    {suggestion.newProblems.length === 0 ? 'No new problems' : `But: ${sentence(suggestion.newProblems[0]).replace(/\.$/, '')}${suggestion.newProblems.length > 1 ? ` (+${suggestion.newProblems.length - 1} more)` : ''}`}
                                  </span>
                                </span>
                                <Button variant="secondary" onClick={() => onSwap(suggestion)}>
                                  {suggestion.studentIds.length === 2 ? 'Swap' : 'Move'}
                                </Button>
                              </div>
                            ))
                          )}
                          {/* A student who needs to see the board may be better served by another layout too. */}
                          {needsFrontSeats(item) && <FrontLayoutsLink onClick={onFrontLayouts} />}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        );
        return (
          <section key={tier} aria-label={title} className="flex flex-col gap-2">
            {tier === 'nice' ? (
              <details>
                <summary className={`cursor-pointer text-sm font-semibold ${tone}`}>
                  {title} ({inTier.length})
                </summary>
                <div className="mt-2">{list}</div>
              </details>
            ) : (
              <>
                <h2 className={`text-sm font-semibold ${tone}`}>
                  {title} ({inTier.length})
                </h2>
                {list}
              </>
            )}
          </section>
        );
      })}

      {done.length > 0 && (
        <section aria-label="Checked off" className="flex flex-col gap-2">
          <button type="button" onClick={() => setShowChecked((show) => !show)} aria-expanded={showChecked} className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink">
            Checked off ({done.length})
          </button>
          {showChecked && (
            <ul className="flex flex-col gap-1">
              {done.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-sm text-ink-muted">
                  <IconCheck className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
                  <span className="min-w-0 flex-1">{sentence(item)}</span>
                  <button type="button" onClick={() => onGotIt(item.key)} className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-sage-ink">
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="Not quite right?" className="flex flex-col gap-2 border-t-2 border-line pt-4">
        <h2 className="text-base font-medium">Not quite right?</h2>
        <div className="flex flex-col gap-2">
          {FEEDBACK.map(({ key, label }) => (
            <Chip key={key} pressed={feedback[key] > 0} disabled={busy} onClick={() => onFeedback(key)} className="justify-start px-4 text-left disabled:cursor-wait">
              {label}
              {STRENGTH[feedback[key]]}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-ink-muted">Each one seats the team again. Tap again to make it stronger, a third time to turn it off.</p>
      </section>
    </div>
  );
}
