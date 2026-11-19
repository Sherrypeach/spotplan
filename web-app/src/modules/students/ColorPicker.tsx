import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import type { DocStudent } from '@modules/classroom/document';
import { COLOR_SWATCHES } from '@modules/classroom/levels';
import { setColor } from '@modules/classroom/rosterEdits';

type Props = {
  student: DocStudent;
};

/** The student's color tag: one of the tags in use, or none. */
export function ColorPicker({ student }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const tags = doc.colors.tags.map((tag, index) => ({ ...tag, index })).filter((tag) => tag.inUse);

  const choose = (color: number | null) => update((current) => setColor(current, student.id, color));
  // A tag that's switched off counts as no tag.
  const current = student.color !== null && doc.colors.tags[student.color]?.inUse ? student.color : null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">Color tag</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={current === null}
          onClick={() => choose(null)}
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-base font-medium ${
            current === null ? 'border-ink' : 'border-line'
          }`}
        >
          <span className="size-5 rounded-full border-2 border-dashed border-field-border" aria-hidden />
          None
        </button>
        {tags.map((tag) => {
          const on = current === tag.index;
          return (
            <button
              key={tag.index}
              type="button"
              aria-pressed={on}
              onClick={() => choose(tag.index)}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-base font-medium ${
                on ? 'border-ink' : 'border-line'
              }`}
            >
              <span className={`size-5 rounded-full ${COLOR_SWATCHES[tag.index]}`} aria-hidden />
              {tag.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
