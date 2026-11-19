import { IconTrash } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { TextArea } from '@components/TextArea';
import { useClassDoc, useClassroom } from '@modules/classroom/classroom';
import { LEVELS } from '@modules/classroom/levels';
import { cycleNeed, MAX_NOTE_LENGTH, removeStudent, setLevel, setNote } from '@modules/classroom/rosterEdits';
import { ColorPicker } from '@modules/students/ColorPicker';
import { HelpMeDecide } from '@modules/students/HelpMeDecide';
import { LevelStamp } from '@modules/students/LevelStamp';
import { NeedChips } from '@modules/students/NeedChips';
import { StudentKeepApart } from '@modules/students/StudentKeepApart';

type Props = {
  studentId: string;
  onClose: () => void;
};

/** Everything about one student: level, needs, color, keep apart and the private note. Changes save as you go. */
export function StudentPanel({ studentId, onClose }: Props) {
  const doc = useClassDoc();
  const { update } = useClassroom();
  const levelGroupId = useId();
  const [deciding, setDeciding] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const removeRef = useRef<HTMLButtonElement>(null);
  const askedToRemove = useRef(false);

  // "Keep" puts focus back on the button that asked, instead of losing it.
  useEffect(() => {
    if (confirmingRemove) askedToRemove.current = true;
    else if (askedToRemove.current) removeRef.current?.focus();
  }, [confirmingRemove]);

  const student = doc.students.find((s) => s.id === studentId);
  if (!student) return null;

  const handleRemove = () => {
    update((current) => removeStudent(current, student.id));
    onClose();
  };

  return (
    <Modal title={student.name} onClose={onClose} footer={<Button className="w-full" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-6">
        <p className="rounded-xl bg-sage-mist px-4 py-2 text-base">Levels, needs and notes are private. They never show on the chart.</p>

        <section aria-labelledby={levelGroupId} className="flex flex-col gap-2">
          <h3 id={levelGroupId} className="text-lg font-semibold">
            Level
          </h3>
          <div className="flex flex-col gap-2">
            {LEVELS.map(({ level, name }) => {
              const on = student.level === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((current) => setLevel(current, student.id, level))}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 text-left text-base font-medium ${
                    on ? 'border-ink' : 'border-line hover:border-sage-line'
                  }`}
                >
                  <LevelStamp level={level} />
                  {name}
                </button>
              );
            })}
          </div>
          {deciding ? (
            <HelpMeDecide name={student.name} onUse={(level) => update((current) => setLevel(current, student.id, level))} onClose={() => setDeciding(false)} />
          ) : (
            <button type="button" onClick={() => setDeciding(true)} className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink">
              Not sure? Help me decide
            </button>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Needs</h3>
          <NeedChips student={student} onCycle={(kind) => update((current) => cycleNeed(current, student.id, kind))} />
        </section>

        {doc.colors.enabled && <ColorPicker student={student} />}

        <StudentKeepApart student={student} />

        <TextArea
          label="Private note"
          hint="Anything else, like “acts up with an audience.” Only you see it."
          maxLength={MAX_NOTE_LENGTH}
          className="[&_textarea]:min-h-24"
          value={student.note}
          spellCheck={false}
          onChange={(event) => update((current) => setNote(current, student.id, event.target.value))}
        />

        <section className="flex flex-col gap-2 border-t-2 border-line pt-4">
          {confirmingRemove ? (
            <div className="flex flex-col gap-3" role="alert">
              <p className="text-base break-words">Remove {student.name} from this team? Their level, needs and notes go too.</p>
              <div className="flex flex-wrap gap-3">
                {/* Focus lands on the safe choice. */}
                <Button variant="secondary" autoFocus onClick={() => setConfirmingRemove(false)}>
                  Keep {student.name}
                </Button>
                <Button variant="danger" onClick={handleRemove}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              ref={removeRef}
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-lg px-2 text-base font-medium text-danger hover:bg-danger/5"
            >
              <IconTrash className="size-5" aria-hidden />
              Remove from team
            </button>
          )}
        </section>
      </div>
    </Modal>
  );
}
