// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChipDrag } from '@modules/students/useChipDrag';

function Chip({ onDrop }: { onDrop: (id: string, zone: string) => void }) {
  const { drag, chipProps } = useChipDrag(onDrop);
  return (
    <>
      <button type="button" {...chipProps('s1', 'Ava', 'basket')}>
        Ava
      </button>
      <p data-testid="drag">{drag ? 'dragging' : 'still'}</p>
    </>
  );
}

describe('dragging a name', () => {
  beforeEach(() => {
    document.elementFromPoint = () => null;
  });

  it('ends when the pointer is let go anywhere on the page, even off the name', () => {
    const onDrop = vi.fn();
    render(<Chip onDrop={onDrop} />);
    const chip = screen.getByRole('button', { name: 'Ava' });
    fireEvent.pointerDown(chip, { button: 0, clientX: 0, clientY: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(chip, { clientX: 40, clientY: 40, pointerType: 'mouse' });
    expect(screen.getByTestId('drag')).toHaveTextContent('dragging');
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(screen.getByTestId('drag')).toHaveTextContent('still');
  });

  it('Escape cancels the drag', () => {
    render(<Chip onDrop={vi.fn()} />);
    const chip = screen.getByRole('button', { name: 'Ava' });
    fireEvent.pointerDown(chip, { button: 0, clientX: 0, clientY: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(chip, { clientX: 40, clientY: 40, pointerType: 'mouse' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('drag')).toHaveTextContent('still');
  });

  it('ignores a second finger lifting while the first one drags', () => {
    render(<Chip onDrop={vi.fn()} />);
    const chip = screen.getByRole('button', { name: 'Ava' });
    fireEvent.pointerDown(chip, { button: 0, clientX: 0, clientY: 0, pointerType: 'mouse', pointerId: 1 });
    fireEvent.pointerMove(chip, { clientX: 40, clientY: 40, pointerType: 'mouse', pointerId: 1 });
    act(() => {
      window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 2 }));
    });
    expect(screen.getByTestId('drag')).toHaveTextContent('dragging');
    act(() => {
      window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1 }));
    });
    expect(screen.getByTestId('drag')).toHaveTextContent('still');
  });
});
