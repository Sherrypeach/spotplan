// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AddPlan } from '@modules/classroom/rosterEdits';
import { NamesPreview } from '@modules/students/NamesPreview';

describe('NamesPreview', () => {
  it('counts only the teammates who will really be added, and says why the others won’t', () => {
    const plan: AddPlan[] = [
      { name: 'Ava', status: 'new' },
      { name: 'Ben', status: 'alreadyIn' },
      { name: 'Cleo', status: 'classFull' },
    ];
    const entries = plan.map((step) => ({ name: step.name, level: 1 as const, color: null }));
    render(<NamesPreview entries={entries} plan={plan} students={[]} onRemove={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Preview: 1 teammate to add' })).toBeInTheDocument();
    expect(screen.getByText('already in your team')).toBeInTheDocument();
    expect(screen.getByText('team is full')).toBeInTheDocument();
    expect(screen.getAllByText(/Level 1, Needs close support/)).toHaveLength(3);
  });

  it('draws at most 60 rows and sums up the rest', () => {
    const plan: AddPlan[] = Array.from({ length: 75 }, (_, i) => ({ name: `Person ${i}`, status: 'new' }));
    const entries = plan.map((step) => ({ name: step.name, level: null, color: null }));
    render(<NamesPreview entries={entries} plan={plan} students={[]} onRemove={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(61);
    expect(screen.getByText('and 15 more')).toBeInTheDocument();
  });
});
