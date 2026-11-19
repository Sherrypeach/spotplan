import { useEffect, useRef } from 'react';

import { Button } from '@components/Button';
import type { DocRoom } from '@modules/classroom/document';
import { layoutName } from '@modules/layouts/layoutName';
import type { Layout } from '@modules/layouts/types';
import { rugOf } from '@modules/room/layoutPlacement';
import { count } from '@shared/text';

/** A layout's pros or cons, as written with the layout. */
export function ProsCons({ title, items, mark, tone }: { title: string; items: string[]; mark: string; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={`text-sm font-bold tracking-wide uppercase ${tone}`}>{title}</h3>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-base">
            <span aria-hidden className={`font-bold ${tone}`}>
              {mark}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

type DetailProps = {
  preview: { layout: Layout; room: DocRoom; problems: number };
  students: number;
  onUse: (extra: number) => void;
  onBack: () => void;
};

/** One layout up close: how it fits the class and the room, its pros and cons, and using it. */
export function LayoutDetail({ preview, students, onUse, onBack }: DetailProps) {
  const { layout, room, problems } = preview;
  const seats = room.seats.length;
  const short = Math.max(0, students - seats);
  const seatWord = rugOf(room) ? 'rug seat' : 'seat';
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [layout.id]);
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 cursor-pointer items-center self-start text-base font-semibold text-sage-ink">
        ← All layouts
      </button>
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-title focus:outline-none">
        {layoutName(layout)}
      </h2>
      <p
        className={`self-start rounded-full px-3 py-1 text-base font-medium ${short > 0 ? 'bg-action-soft text-action-on' : 'bg-sage-soft text-sage-ink'}`}
        aria-live="polite"
      >
        {count(seats, seatWord)}
        {students > 0 && ` · your team has ${students}`}
        {short > 0 ? ` · ${short} short` : students > 0 && seats > students ? ` · ${seats - students} extra` : students > 0 ? ' ✓' : ''}
      </p>
      {problems > 0 && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-base text-danger" role="status">
          {problems === 1 ? '1 desk lands on your furniture or a wall' : `${problems} desks land on your furniture or a wall`}. They’re outlined in red; you can drag them after.
        </p>
      )}
      <div className="grid gap-4">
        <ProsCons title="Pros" items={layout.pros} mark="+" tone="text-sage-ink" />
        <ProsCons title="Cons" items={layout.cons} mark="–" tone="text-ink-muted" />
      </div>
      <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
        {short > 0 ? (
          <>
            <Button onClick={() => onUse(short)}>Use this layout + add {count(short, seatWord)}</Button>
            <Button variant="secondary" onClick={() => onUse(0)}>
              Use it as is
            </Button>
          </>
        ) : (
          <Button onClick={() => onUse(0)}>Use this layout</Button>
        )}
      </div>
    </div>
  );
}
