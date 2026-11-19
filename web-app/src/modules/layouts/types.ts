// Shape of library.json, produced by scripts/extract-layouts.py. Units are desk
// lengths; FRONT is the top edge (y = 0); angles are degrees clockwise.

export type LayoutCategory =
  | 'desks'
  | 'rectangle-tables'
  | 'trapezoid-tables'
  | 'triangle-tables'
  | 'carpets';

type PieceBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipH: boolean;
};

export type Furniture = PieceBase &
  (
    | { kind: 'desk' | 'rectangle-table' | 'triangle-table' }
    | { kind: 'trapezoid-table'; inset: number }
    | { kind: 'storage' | 'supply-desk'; label?: string }
    | { kind: 'carpet'; shape: 'rectangle' | 'oval' | 'circle' }
    | { kind: 'carpet'; shape: 'semicircle' | 'wedge'; sweep: number }
  );

export type Seat = {
  id: string;
  x: number;
  y: number;
  furnitureId: string;
  facing: number;
};

export type Layout = {
  id: string;
  name: string;
  category: LayoutCategory;
  // Printed with the layout, e.g. "24", "25+", "24 or 28"; display text only.
  statedCounts: Partial<Record<'students' | 'desks' | 'tables', string>>;
  pros: string[];
  cons: string[];
  stage: { width: number; height: number };
  furniture: Furniture[];
  seats: Seat[];
  arrangement?: string;
  directions?: string[];
  teacherPlacesSpots?: true;
  spotPile?: { x: number; y: number; count: number; diameter: number };
  // Where the printed counts disagree with the drawing. Not for display.
  notes?: string[];
};

export type LayoutLibrary = {
  unit: 'desk';
  layouts: Layout[];
};
