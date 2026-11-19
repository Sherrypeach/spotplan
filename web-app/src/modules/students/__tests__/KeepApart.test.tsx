// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ClassroomDocument } from '@modules/classroom/document';
import { KeepApartSection } from '@modules/students/KeepApartSection';
import { StudentKeepApart } from '@modules/students/StudentKeepApart';
import { docWith, student } from '@test/classroomDocs';
import { TestClassroom } from '@test/TestClassroom';

const CLASS = docWith([student('a', 'Ava'), student('b', 'Ben'), student('c', 'Cleo')]);

describe('KeepApartSection', () => {
  it('adds a pair, and says so when the pair is already there', async () => {
    const changes = vi.fn<(doc: ClassroomDocument) => void>();
    render(
      <TestClassroom initial={CLASS} onChange={changes}>
        <KeepApartSection />
      </TestClassroom>,
    );
    const pick = async () => {
      await userEvent.selectOptions(screen.getByLabelText('First teammate'), 'Ava');
      await userEvent.selectOptions(screen.getByLabelText('Second teammate'), 'Ben');
      await userEvent.click(screen.getByRole('button', { name: 'Keep apart' }));
    };
    await pick();
    expect(changes.mock.calls.at(-1)?.[0].keepApart).toEqual([{ a: 'a', b: 'b' }]);
    expect(screen.getByRole('status')).toHaveTextContent('Ava and Ben will sit apart.');

    await pick();
    expect(screen.getByRole('status')).toHaveTextContent('Ava and Ben are already kept apart.');
    expect(changes).toHaveBeenCalledTimes(1);
  });
});

describe('StudentKeepApart', () => {
  it('adds a partner only when the Add button is pressed', async () => {
    const changes = vi.fn<(doc: ClassroomDocument) => void>();
    render(
      <TestClassroom initial={CLASS} onChange={changes}>
        <StudentKeepApart student={CLASS.students[0]} />
      </TestClassroom>,
    );
    await userEvent.selectOptions(screen.getByLabelText('A teammate to keep apart from Ava'), 'Cleo');
    expect(changes).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(changes.mock.calls.at(-1)?.[0].keepApart).toEqual([{ a: 'a', b: 'c' }]);
    expect(screen.getByText('Cleo')).toBeInTheDocument();
  });
});
