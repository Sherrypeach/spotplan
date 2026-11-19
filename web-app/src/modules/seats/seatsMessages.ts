import type { ClassroomDocument } from '@modules/classroom/document';
import type { CheckItem, Level, SeatLabels } from '@modules/seating/engine';
import { currentAssignment, fits, labelOf } from '@modules/seats/seatingModel';
import type { DragState } from '@modules/students/useChipDrag';
import { count } from '@shared/text';

/** "Placed 24 students. 3 things to check, 1 that needs attention." While private, only how many were placed. */
export function placedMessage(doc: ClassroomDocument, items: CheckItem[], hidden: boolean): string {
  const placed = `Placed ${count(Object.keys(currentAssignment(doc)).length, 'teammate')}.`;
  if (hidden) return placed;
  const open = items.filter((item) => !doc.seating.checkedOff.includes(item.key));
  if (open.length === 0) return `${placed} Nothing to check.`;
  const urgent = open.filter((item) => item.tier === 'attention').length;
  const needs = urgent === 0 ? '' : `, ${urgent} that ${urgent === 1 ? 'needs' : 'need'} attention`;
  return `${placed} ${count(open.length, 'thing')} to check${needs}.`;
}

/** What "Fix what I can" did, from how many things were open before and now. */
export function fixedMessage(before: number | null, now: number): string {
  if (before === null) return '';
  if (now === 0) return 'All fixed!';
  if (now >= before) return 'No swap makes it better without causing something worse. Try moving someone yourself, or Got it.';
  return `Better now: ${count(now, 'thing')} still open. No swap fixes ${now === 1 ? 'it' : 'them'} without causing something worse.`;
}

/** What the seat under a dragged name says: "2 seat · fits", "not a fit", or "Unseated". */
export function dragHintFor(drag: DragState | null, labels: SeatLabels, level: Level, hidden: boolean): string {
  if (!drag?.over) return '';
  if (drag.over === 'unseated') return 'Unseated';
  if (!drag.over.startsWith('seat:')) return '';
  if (hidden) return 'Drop here';
  const label = labelOf(labels, drag.over.slice('seat:'.length));
  return `${label} seat · ${fits(level, label) ? 'fits' : 'not a fit'}`;
}
