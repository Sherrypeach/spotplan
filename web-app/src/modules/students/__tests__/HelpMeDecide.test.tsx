// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HelpMeDecide } from '@modules/students/HelpMeDecide';

function start() {
  const onUse = vi.fn();
  const onClose = vi.fn();
  render(<HelpMeDecide name="Ava" onUse={onUse} onClose={onClose} />);
  return { onUse, onClose };
}

describe('Help me decide', () => {
  it('stops at the first answer that settles it and says why', async () => {
    const { onUse, onClose } = start();
    expect(screen.getByText(/Is Ava new to the team/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(screen.getByText('Ava gets pulled into side conversations.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use level 2' }));
    expect(onUse).toHaveBeenCalledWith(2);
    expect(onClose).toHaveBeenCalled();
  });

  it('gives a 2 when the last answer is no, and lets the manager pick instead', async () => {
    const { onUse } = start();
    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByText('Ava does best with the right neighbors.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I’ll pick myself' }));
    expect(onUse).not.toHaveBeenCalled();
  });

  it('settles a 1 on the first yes', async () => {
    const { onUse } = start();
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use level 1' }));
    expect(onUse).toHaveBeenCalledWith(1);
  });
});
