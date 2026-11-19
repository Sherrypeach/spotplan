import type { Layout } from '@modules/layouts/types';

export type WantKey = 'group' | 'partner' | 'front' | 'quiet' | 'reach' | 'big' | 'narrow';

export type Want = {
  key: WantKey;
  label: string;
  /** Matched against the layout's pros, in office wording. */
  pattern: RegExp;
};

/** The "I want:" filters, read from each layout's pros. */
export const WANTS: Want[] = [
  { key: 'group', label: 'Team collaboration', pattern: /collaborat|team discussions|workshops/i },
  { key: 'partner', label: 'Pair work', pattern: /pair work|partner/i },
  { key: 'front', label: 'Faces the screen', pattern: /faces? the screen/i },
  { key: 'quiet', label: 'Focus', pattern: /fewer distractions|more focus/i },
  { key: 'reach', label: 'Easy to reach', pattern: /manager to (reach|walk)/i },
  { key: 'big', label: 'Big team or small office', pattern: /fits a big team|saves space/i },
  { key: 'narrow', label: 'Long, narrow offices', pattern: /narrow/i },
];

/** Whether the layout's pros promise the want. */
export function offers(layout: Pick<Layout, 'pros'>, want: Want): boolean {
  return layout.pros.some((pro) => want.pattern.test(pro));
}

/** Layouts that offer every one of the wants. */
export function offeringAll<T extends Pick<Layout, 'pros'>>(layouts: T[], wants: Want[]): T[] {
  return layouts.filter((layout) => wants.every((want) => offers(layout, want)));
}
