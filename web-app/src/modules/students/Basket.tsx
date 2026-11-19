import type { DocStudent } from '@modules/classroom/document';
import { LEVEL_BASKET, levelName } from '@modules/classroom/levels';
import { LevelStamp } from '@modules/students/LevelStamp';
import type { Level } from '@modules/seating/engine/types';

type Props = {
  level: Level | null;
  students: DocStudent[];
  selectedId: string | null;
  onSelect: (studentId: string) => void;
  /** Tapping the basket drops the selected student in it. */
  onDrop: () => void;
  /** For dragging: this basket's drop zone name, and the drag handlers for a chip. */
  dropZone?: string;
  dragChip?: (id: string, name: string) => object;
  /** A name is being dragged over this basket. */
  dragOver?: boolean;
};

/** One level's basket: its stamp, name and count, and a name chip per student. */
export function Basket({ level, students, selectedId, onSelect, onDrop, dropZone, dragChip, dragOver = false }: Props) {
  const look = level ? LEVEL_BASKET[level] : 'border-field-border bg-card';
  const title = level ? levelName(level) : 'No level yet';
  // The "No level yet" basket only holds students; nobody is put back in it.
  const waiting = level !== null && selectedId !== null && !students.some((student) => student.id === selectedId);

  return (
    <section
      aria-label={title}
      data-drop-zone={dropZone}
      onClick={onDrop}
      className={`flex min-h-40 flex-col gap-3 rounded-2xl border-3 border-dashed p-3 ${look} ${waiting || dragOver ? 'cursor-pointer ring-3 ring-action-soft' : ''}`}
    >
      <header className="flex items-center gap-2">
        <LevelStamp level={level} />
        <div className="leading-tight">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-base text-ink-muted">
            {students.length} {students.length === 1 ? 'teammate' : 'teammates'}
          </p>
        </div>
      </header>
      {waiting && (
        <button
          type="button"
          className="min-h-11 cursor-pointer rounded-xl bg-card/80 text-base font-semibold"
          onClick={(event) => {
            event.stopPropagation();
            onDrop();
          }}
        >
          Put here
        </button>
      )}
      <ul className="flex flex-wrap gap-2">
        {students.map((student) => {
          const selected = student.id === selectedId;
          return (
            <li key={student.id}>
              <button
                type="button"
                aria-pressed={selected}
                data-student-id={student.id}
                {...dragChip?.(student.id, student.name)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(student.id);
                }}
                className={`min-h-11 cursor-pointer rounded-full border-2 bg-card px-4 text-base font-medium select-none [-webkit-touch-callout:none] ${
                  selected ? 'border-ink ring-3 ring-action-soft' : 'border-field-border hover:border-sage-line'
                }`}
              >
                {student.name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
