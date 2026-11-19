import { useState } from 'react';

import { ColorTagsSection } from '@modules/students/ColorTagsSection';
import { KeepApartSection } from '@modules/students/KeepApartSection';
import { StudentList } from '@modules/students/StudentList';
import { StudentPanel } from '@modules/students/StudentPanel';

/** Optional extras: each student's needs and note, pairs to keep apart, and color tags. */
export function ExtrasPart() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink-muted">All optional. Skip whatever you don’t need.</p>
      <StudentList onOpen={setOpenId} />
      <KeepApartSection />
      <ColorTagsSection />
      {openId && <StudentPanel studentId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
