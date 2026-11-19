import type { Layout } from '@modules/layouts/types';

/** A layout's name as teachers see it: carpets are called rugs. */
export function layoutName(layout: Pick<Layout, 'name' | 'category'>): string {
  return layout.category === 'carpets' ? layout.name.replace(/\s*Carpet$/, ' rug') : layout.name;
}
