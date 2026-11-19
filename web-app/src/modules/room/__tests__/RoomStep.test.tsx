// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ClassroomDocument } from '@modules/classroom/document';
import { RoomStep } from '@modules/room/RoomStep';
import { toFeet } from '@modules/room/units';
import { docWith, emptyDoc, student } from '@test/classroomDocs';
import { LocationProbe } from '@test/LocationProbe';
import { TestClassroom } from '@test/TestClassroom';

// Opens a layout's card, then uses it as it comes.
async function useLayout(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
  await userEvent.click(screen.getByRole('button', { name: /^Use (it as is|this layout)$/ }));
}

function renderRoom(path = '/room', initial = emptyDoc()) {
  const changes = vi.fn<(doc: ClassroomDocument) => void>();
  render(
    <TestClassroom initial={initial} onChange={changes}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/room" element={<RoomStep />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </TestClassroom>,
  );
  return { latest: () => changes.mock.calls.at(-1)?.[0] };
}

describe('RoomStep', () => {
  it('opens on the shape, drawn with its size in feet', () => {
    renderRoom();
    expect(screen.getByRole('heading', { name: 'Draw your room' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Rectangle · 30 × 24 ft/ })).toBeInTheDocument();
  });

  it('changes the size with − and +, or by typing', async () => {
    const { latest } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: 'Side to side: 1 foot more' }));
    expect(toFeet(latest()!.room.width)).toBe(31);
    const depth = screen.getByRole('spinbutton', { name: 'Front to back' });
    await userEvent.clear(depth);
    await userEvent.type(depth, '28{enter}');
    expect(toFeet(latest()!.room.depth)).toBe(28);
  });

  it('makes an L-shape and picks the missing corner', async () => {
    const { latest } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /L-shape/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Front left' }));
    expect(latest()!.room).toMatchObject({ shape: 'l-shape', cutCorner: 'top-left' });
  });

  it('moves through the parts and on to Seats, locking the room', async () => {
    const { latest } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: /Next: layout/ }));
    expect(screen.getByRole('heading', { name: 'Choose a desk layout' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next: where I work/ }));
    expect(screen.getByRole('heading', { name: 'Where do you usually work from?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Lock in my room/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/seats');
    expect(latest()!.room.locked).toBe(true);
  });

  it('keeps a locked room as it is until Unlock', async () => {
    const doc = emptyDoc();
    renderRoom('/room?part=desks', { ...doc, room: { ...doc.room, locked: true } });
    const firstCard = (await screen.findAllByRole('button', { pressed: false })).find((button) => button.querySelector('svg'))!;
    expect(firstCard).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear the room' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Shape/ }));
    expect(screen.getByRole('button', { name: 'Add a door' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(screen.getByRole('button', { name: 'Add a door' })).toBeEnabled();
  });

  it('lets Undo take away the first spot on Where I work without it coming back', async () => {
    const { latest } = renderRoom('/room?part=teach');
    expect(await screen.findByRole('button', { name: 'Where I work' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest()!.room.spots).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Where I work' })).not.toBeInTheDocument();
  });

  it('starts Where I work with a marker at the front, and gives furniture added in Shape its own time', async () => {
    const { latest } = renderRoom('/room?part=teach');
    expect(await screen.findByRole('button', { name: 'Where I work' })).toBeInTheDocument();
    expect(latest()!.room.spots).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Add it in Shape' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rug' }));
    expect(latest()!.room.pieces.map((piece) => piece.kind)).toEqual(['rug']);
    await userEvent.click(screen.getByRole('button', { name: /Next: layout/ }));
    await userEvent.click(screen.getByRole('button', { name: /Next: where I work/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'How much time at Rug' })).getByRole('button', { name: 'Most of my time' }));
    const tableSpot = latest()!.room.spots.find((spot) => spot.pieceId);
    expect(tableSpot?.time).toBe('most');
  });

  it('moves, turns and removes furniture, taking its place in Where I work with it', async () => {
    const { latest } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: 'My desk' }));
    const desk = latest()!.room.pieces[0];
    screen.getByRole('button', { name: /^My desk\. Tap to pick it up/ }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    const moved = latest()!.room;
    expect(moved.pieces[0].x).toBeLessThan(desk.x);
    expect(moved.spots[0]).toMatchObject({ x: moved.pieces[0].x, y: moved.pieces[0].y, pieceId: desk.id });
    await userEvent.click(screen.getByRole('button', { name: 'Turn My desk' }));
    expect(latest()!.room.pieces[0].rotation).toBe(90);
    await userEvent.click(screen.getByRole('button', { name: 'Remove My desk' }));
    expect(latest()!.room.pieces).toEqual([]);
    expect(latest()!.room.spots).toEqual([]);
  });

  it('moves the board to another wall from Shape', async () => {
    const { latest } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(latest()!.room.front).toBe('right');
    expect(screen.getByRole('button', { name: 'Right' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds a door and a window in Shape', async () => {
    const { latest } = renderRoom();
    await userEvent.click(screen.getByRole('button', { name: 'Add a door' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add a window' }));
    expect(latest()!.room.pieces.map((piece) => piece.kind)).toEqual(['door', 'window']);
    const before = latest()!.room.pieces[0].x;
    screen.getByRole('button', { name: /^Door 1\. Drag/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(latest()!.room.pieces[0].x).toBeGreaterThan(before);
    await userEvent.click(screen.getByRole('button', { name: 'Remove this door' }));
    expect(latest()!.room.pieces.map((piece) => piece.kind)).toEqual(['window']);
  });

  it('shows popular layouts and a way to add the team when there are no teammates yet', async () => {
    renderRoom('/room?part=desks');
    expect(await screen.findByRole('heading', { name: 'Popular layouts' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Add your team first/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/students');
  });

  it('puts the chosen layout in the room and adds the seats the team is short', async () => {
    const students = Array.from({ length: 27 }, (_, index) => student(`s${index}`, `Person ${index}`));
    const { latest } = renderRoom('/room?part=desks', docWith(students));
    expect(await screen.findByRole('heading', { name: 'Good fits for 27 teammates' })).toBeInTheDocument();
    expect(screen.getByText('Select an option')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /More ways/ }));
    await useLayout(/^Individual desks/);
    expect(latest()!.room.layout?.id).toBe('desks-traditional');
    expect(screen.getByText('25 seats · your team has 27 · 2 short')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 seats' }));
    expect(latest()!.room.seats).toHaveLength(27);
    expect(screen.getByText('27 seats for 27 teammates ✓')).toBeInTheDocument();
  });

  it('makes the desks smaller in place, keeping added seats', async () => {
    const students = Array.from({ length: 26 }, (_, index) => student(`s${index}`, `Person ${index}`));
    const { latest } = renderRoom('/room?part=desks', docWith(students));
    await userEvent.click(await screen.findByRole('button', { name: /More ways/ }));
    await useLayout(/^Individual desks/);
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 seat' }));
    fireEvent.change(screen.getByRole('slider', { name: /Layout size/ }), { target: { value: '65' } });
    fireEvent.keyUp(screen.getByRole('slider', { name: /Layout size/ }));
    expect(latest()!.room.layout?.size).toBe(0.65);
    expect(latest()!.room.seats).toHaveLength(26);
    expect(screen.getByRole('slider', { name: /Layout size/ })).toHaveValue('65');
    expect(screen.getByText('65% of real size')).toBeInTheDocument();
  });

  it('only filters the layouts when the manager picks another kind of seating', async () => {
    const { latest } = renderRoom('/room?part=desks');
    await userEvent.click(await screen.findByRole('button', { name: /More ways/ }));
    await useLayout(/^Individual desks/);
    expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tables' }));
    expect(latest()!.room.layout?.id).toBe('desks-traditional');
    expect(screen.getByText('Select an option')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Individual desks/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desks' }));
    expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
  });

  it('picks up a table and shows its tools on the drawing', async () => {
    const { latest } = renderRoom('/room?part=desks');
    await userEvent.click(await screen.findByRole('button', { name: /More ways/ }));
    await useLayout(/^Individual desks/);
    const desks = screen.getAllByRole('button', { name: /^Desk, 1 seat/ });
    desks[0].focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('toolbar', { name: /Desk · 1 seat/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(latest()!.room.seats).toHaveLength(24);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('takes changes back one at a time with Undo or Ctrl+Z, and starts the room over after asking', async () => {
    const { latest } = renderRoom();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Side to side: 1 foot more' }));
    await userEvent.click(screen.getByRole('button', { name: 'Side to side: 1 foot more' }));
    expect(toFeet(latest()!.room.width)).toBe(32);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(toFeet(latest()!.room.width)).toBe(31);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(toFeet(latest()!.room.width)).toBe(30);

    await userEvent.click(screen.getByRole('button', { name: /L-shape/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add a door' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear the room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep my room' }));
    expect(latest()!.room.shape).toBe('l-shape');
    await userEvent.click(screen.getByRole('button', { name: 'Clear the room' }));
    expect(screen.getByRole('dialog', { name: 'Clear the room?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, clear it' }));
    expect(latest()!.room.shape).toBe('rectangle');
    expect(latest()!.room.pieces.map((piece) => piece.kind)).toEqual(['door']);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest()!.room.shape).toBe('l-shape');
  });

  it('brings back a changed layout when it is picked again', async () => {
    const { latest } = renderRoom('/room?part=desks');
    await userEvent.click(await screen.findByRole('button', { name: /More ways/ }));
    await useLayout(/^Individual desks/);
    fireEvent.change(screen.getByRole('slider', { name: /Layout size/ }), { target: { value: '65' } });
    fireEvent.keyUp(screen.getByRole('slider', { name: /Layout size/ }));
    await useLayout(/^Pods of 4/);
    expect(latest()!.room.layout?.id).not.toBe('desks-traditional');
    await useLayout(/^Individual desks/);
    expect(latest()!.room.layout).toEqual({ id: 'desks-traditional', size: 0.65 });
  });

  it('shows the desks again when Undo brings back a layout of another kind', async () => {
    const { latest } = renderRoom('/room?part=desks');
    await userEvent.click(await screen.findByRole('button', { name: /More ways/ }));
    await useLayout(/^Individual desks/);
    await userEvent.click(screen.getByRole('button', { name: 'Tables' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Layouts' })).getAllByRole('button')[0]);
    await userEvent.click(screen.getByRole('button', { name: /^Use (it as is|this layout)/ }));
    expect(latest()!.room.layout?.id).not.toBe('desks-traditional');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest()!.room.layout?.id).toBe('desks-traditional');
    expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
  });
});
