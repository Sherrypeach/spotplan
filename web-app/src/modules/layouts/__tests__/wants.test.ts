import { describe, expect, it } from 'vitest';

import library from '@modules/layouts/library.json';
import type { LayoutLibrary } from '@modules/layouts/types';
import { offeringAll, offers, WANTS } from '@modules/layouts/wants';

const layouts = (library as unknown as LayoutLibrary).layouts;
const want = (key: string) => WANTS.find((candidate) => candidate.key === key)!;
const named = (name: string) => layouts.find((layout) => layout.name === name)!;

describe('I want filters', () => {
  it('reads each want from the pros', () => {
    expect(offers(named('Individual desks'), want('front'))).toBe(true);
    expect(offers(named('Individual desks'), want('quiet'))).toBe(true);
    expect(offers(named('Individual desks'), want('group'))).toBe(false);
  });

  it('keeps only layouts that offer every chosen want', () => {
    const both = offeringAll(layouts, [want('group'), want('partner')]);
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((layout) => offers(layout, want('group')) && offers(layout, want('partner')))).toBe(true);
  });

  it('finds at least one desk layout for every want', () => {
    const desks = layouts.filter((layout) => layout.category === 'desks');
    for (const each of WANTS) expect(offeringAll(desks, [each]).length, each.label).toBeGreaterThan(0);
  });
});
