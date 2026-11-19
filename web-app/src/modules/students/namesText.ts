import type { ColorTag } from '@modules/classroom/document';
import type { RosterEntry } from '@modules/classroom/rosterImport';

/** Writes entries back as pasted lines ("Noah, 3, blue"), so a spreadsheet can be checked in the box. */
export function entriesToText(entries: RosterEntry[], tags: ColorTag[]): string {
  return entries
    .map((entry) => {
      const parts = [entry.name];
      if (entry.level) parts.push(String(entry.level));
      if (entry.color !== null) parts.push(tags[entry.color]?.name ?? '');
      return parts.join(', ');
    })
    .join('\n');
}
