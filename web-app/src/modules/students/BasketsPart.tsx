import { useEffect, useState } from 'react';

import { Button } from '@components/Button';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import { levelName } from '@modules/classroom/levels';
import { fillMissingLevels, setLevel } from '@modules/classroom/rosterEdits';
import { Basket } from '@modules/students/Basket';
import { LevelsExplained } from '@modules/students/LevelsExplained';
import { MoveByName } from '@modules/students/MoveByName';
import { useChipDrag } from '@modules/students/useChipDrag';
import type { Level } from '@modules/seating/engine/types';

const BASKET_LEVELS: Level[] = [1, 2, 3];

/** The whole class in three baskets. Drag a name to another basket, click a name then a basket, or type a name. */
export function BasketsPart() {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ id: string; message: string; follow: boolean } | null>(null);

  const selected = doc.students.find((student) => student.id === selectedId) ?? null;
  const unleveled = doc.students.filter((student) => student.level === null);

  /** `follow`: focus moves with the student into their new basket (not when typing names). */
  const moveTo = (studentId: string, level: Level, follow = false) => {
    update((current) => setLevel(current, studentId, level));
    const name = doc.students.find((student) => student.id === studentId)?.name ?? '';
    setMoved({ id: studentId, message: `${name} is now in “${levelName(level)}”.`, follow });
  };

  useEffect(() => {
    if (moved?.follow) document.querySelector<HTMLElement>(`[data-student-id="${moved.id}"]`)?.focus();
  }, [moved]);

  // Each level's basket is a drop zone named "level-1", "level-2", "level-3".
  const zoneOf = (level: Level) => `level-${level}`;
  const { drag, chipProps, ghostRef } = useChipDrag((id, zone) => {
    const level = BASKET_LEVELS.find((candidate) => zoneOf(candidate) === zone);
    if (!level) return;
    setSelectedId(null);
    moveTo(id, level);
  });
  const dragChip = (from: string) => (id: string, name: string) => chipProps(id, name, from);

  const dropInto = (level: Level) => {
    if (!selectedId) return;
    moveTo(selectedId, level, true);
    setSelectedId(null);
  };

  const status = selected
    ? `Now click the basket for ${selected.name}.`
    : (moved?.message ?? 'Want to change someone? Drag their name to another basket, or tap it and then the basket.');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink-muted" role="status">
        {status}
      </p>
      <LevelsExplained />
      <MoveByName students={doc.students} onMove={moveTo} />
      {unleveled.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-base">
            {unleveled.length} {unleveled.length === 1 ? 'teammate has' : 'teammates have'} no level yet.
          </p>
          <Button variant="secondary" onClick={() => update((current) => fillMissingLevels(current, 2))}>
            {unleveled.length === 1 ? 'Make them a 2' : 'Make them 2s'}
          </Button>
        </div>
      )}
      {unleveled.length > 0 && (
        <Basket
          level={null}
          students={unleveled}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          onDrop={() => setSelectedId(null)}
          dragChip={dragChip('unleveled')}
        />
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {BASKET_LEVELS.map((level) => (
          <Basket
            key={level}
            level={level}
            students={doc.students.filter((student) => student.level === level)}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
            onDrop={() => dropInto(level)}
            dropZone={zoneOf(level)}
            dragChip={dragChip(zoneOf(level))}
            dragOver={drag?.over === zoneOf(level)}
          />
        ))}
      </div>

      {/* The name following the pointer while it's dragged. */}
      {drag && (
        <div
          ref={ghostRef}
          aria-hidden
          className="pointer-events-none fixed z-50 inline-flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center rounded-full border-2 border-sage bg-card px-4 text-base font-medium shadow-lg select-none"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.name}
        </div>
      )}
    </div>
  );
}
