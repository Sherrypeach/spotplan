import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import { COLOR_SWATCHES } from '@modules/classroom/levels';
import { setColorsEnabled, updateColorTag } from '@modules/classroom/rosterEdits';
import { TagNameInput } from '@modules/students/TagNameInput';

/** Optional color tags, off until the teacher turns them on. The teacher names them. */
export function ColorTagsSection() {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const { enabled, tags } = doc.colors;
  const countOf = (index: number) =>
    tags[index].inUse ? doc.students.filter((student) => student.color === index).length : 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="text-xl font-semibold">Color tags</h2>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium">
        <input
          type="checkbox"
          role="switch"
          className="size-6 accent-sage"
          checked={enabled}
          onChange={(event) => update((current) => setColorsEnabled(current, event.target.checked))}
        />
        Use color tags
      </label>
      <p className="text-base text-ink-muted">For example, one color per project. Rename them however you like.</p>
      {enabled && (
        <ul className="flex flex-col gap-2">
          {tags.map((tag, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3">
              <span className={`size-7 shrink-0 rounded-full ${COLOR_SWATCHES[index]}`} aria-hidden />
              <TagNameInput
                index={index}
                name={tag.name}
                onRename={(name) => update((current) => updateColorTag(current, index, { name }))}
              />
              <span className="text-base text-ink-muted">
                {countOf(index)} {countOf(index) === 1 ? 'teammate' : 'teammates'}
              </span>
              <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 text-base">
                <input
                  type="checkbox"
                  className="size-5 accent-sage"
                  checked={tag.inUse}
                  onChange={(event) => update((current) => updateColorTag(current, index, { inUse: event.target.checked }))}
                />
                Use<span className="sr-only"> {tag.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
