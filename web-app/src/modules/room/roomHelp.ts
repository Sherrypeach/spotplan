import type { LayoutCategory } from '@modules/layouts/types';

// Tips for each part of the Room step, shown on the How to use page.
const UNDO_TIP = 'Made a mistake? Undo takes back one change at a time.';
export const TEACH_HELP = [
  'Drag the green marker to where you stand most, like by the screen.',
  'Furniture you added in Shape, like your desk, shows up here too.',
  'Pick how much time you spend at each one. The 1 seats go closest to where you spend the most.',
  'Lock in your room when you’re done, so the desks can’t move by accident.',
];
export const SHAPE_HELP = [
  'Drag the circles on the walls to make the room bigger or smaller.',
  'Pick L-shaped if your room has a corner missing, then tap that corner.',
  'Drag the screen, a door, a window or your furniture to where it really is. Press R to turn furniture.',
  UNDO_TIP,
];
export const TABLE_TIPS = [
  'Tap a table to pick it up, then drag it anywhere. Tap it again, or Done, to put it down.',
  'Drag the round arrow next to it to turn it to any angle, or use Turn.',
  'Copy makes another table just like it. Split breaks a table into pieces you can move one by one.',
  'Red means it goes through a wall, onto another table or onto your furniture.',
];
export const KIND_HELP: Record<LayoutCategory, string[]> = {
  desks: [
    'Pick a card to put those desks in your room.',
    'Tap a group of desks to pick it up, then drag it anywhere. Tap again, or Done, to put it down.',
    'Drag the round arrow next to it to turn it to any angle, or use Turn.',
    'Split breaks a group into single desks you can move one by one.',
    'Need more desks? Add seats puts single desks at the back.',
    'Red means a desk goes through a wall, onto another one or onto your furniture.',
    UNDO_TIP,
  ],
  'rectangle-tables': ['Pick a card to put those tables in your room.', ...TABLE_TIPS, UNDO_TIP],
  'trapezoid-tables': ['Pick a card to put those tables in your room.', 'Trapezoid tables fit together like puzzle pieces: they move as one group until you Split them.', ...TABLE_TIPS, UNDO_TIP],
  'triangle-tables': ['Pick a card to put those tables in your room.', 'Turn triangle tables to make stars, butterflies or zigzags.', ...TABLE_TIPS, UNDO_TIP],
  carpets: [
    'Each dot on the rug is one person. Drag them where you like.',
    'Drag any dot to put that person anywhere on the rug.',
    'Tap a rug seat, then Remove, to take it away. Add rug seats puts more on the rug.',
    'Drag the rug itself to move it with everyone on it.',
    UNDO_TIP,
  ],
};
