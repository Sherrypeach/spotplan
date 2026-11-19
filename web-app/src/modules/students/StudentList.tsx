import { IconChevronRight } from '@tabler/icons-react';

import { useClassDoc } from '@modules/classroom/classroom';
import type { DocStudent } from '@modules/classroom/document';
import { COLOR_SWATCHES, NEEDS } from '@modules/classroom/levels';
import { partnersOf } from '@modules/classroom/rosterEdits';
import { LevelStamp } from '@modules/students/LevelStamp';

type Props = {
  onOpen: (studentId: string) => void;
};

function summary(student: DocStudent, apartCount: number): string {
  const needs = NEEDS.filter((need) => student.needs[need.kind]).map((need) => {
    const strength = student.needs[need.kind] === 'must' ? 'Must' : 'Nice';
    return `${strength}: ${need.label.replace(/^Needs (to )?/, '')}`;
  });
  const extras = [...needs];
  if (apartCount > 0) extras.push(`Keep apart from ${apartCount}`);
  if (student.note) extras.push('Note');
  return extras.join(' · ');
}

/** One row per student; tapping a row opens everything about them. */
export function StudentList({ onOpen }: Props) {
  const doc = useClassDoc();
  const apartCount = (id: string) => partnersOf(doc, id).length;

  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="text-xl font-semibold">Needs and notes</h2>
      <p className="text-base text-ink-muted">Tap a teammate to add needs, like sitting near the front, or a private note.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {doc.students.map((student) => {
          const details = summary(student, apartCount(student.id));
          return (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onOpen(student.id)}
                className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-line px-3 py-2 text-left hover:border-sage-line"
              >
                <LevelStamp level={student.level} size="sm" announce />
                {doc.colors.enabled && student.color !== null && doc.colors.tags[student.color]?.inUse && (
                  <>
                    <span className={`size-4 shrink-0 rounded-full ${COLOR_SWATCHES[student.color]}`} aria-hidden />
                    <span className="sr-only">{doc.colors.tags[student.color]?.name}, </span>
                  </>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{student.name}</span>
                  {details && <span className="block text-sm text-ink-muted">{details}</span>}
                </span>
                <IconChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
