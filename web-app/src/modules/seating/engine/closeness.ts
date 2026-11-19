import { distanceToShape } from './geometry';
import type { EngineSettings } from './settings';
import type { Point, TeacherSpot } from './types';

export type Zone = 'green' | 'yellow' | 'red';

export type Closeness = {
  // 0 to 1: how much of the day the seat sits close to the teacher.
  closeness: number;
  // Distance to the nearest spot the teacher spends time at, in desk widths.
  desksFromTeacher: number;
  zone: Zone;
};

// 1 in the green zone, down to the yellow score at the edge of the yellow
// zone, then fading toward 0.
function zoneScore(desks: number, settings: EngineSettings): number {
  const { greenDesks, yellowDesks, yellowScore, redFadeDesks } = settings.closeness;
  if (desks <= greenDesks) return 1;
  if (desks <= yellowDesks) {
    return 1 - ((1 - yellowScore) * (desks - greenDesks)) / (yellowDesks - greenDesks);
  }
  return yellowScore * Math.pow(0.5, (desks - yellowDesks) / redFadeDesks);
}

function zoneOf(desks: number, settings: EngineSettings): Zone {
  if (desks <= settings.closeness.greenDesks) return 'green';
  if (desks <= settings.closeness.yellowDesks) return 'yellow';
  return 'red';
}

// Spots the teacher spends time at; without any, the middle of the front wall.
export function spotsInUse(spots: TeacherSpot[], frontMiddle: Point, settings: EngineSettings): TeacherSpot[] {
  const used = spots.filter((spot) => settings.closeness.timeWeight[spot.time] > 0);
  if (used.length > 0) return used;
  return [{ id: 'front', time: 'most', ...frontMiddle }];
}

export function closenessOf(seat: Point, spots: TeacherSpot[], deskWidth: number, settings: EngineSettings): Closeness {
  const { timeWeight, bestSpotShare } = settings.closeness;
  const fullTime = timeWeight.most;
  let best = 0;
  let weighted = 0;
  let totalWeight = 0;
  let nearest = Infinity;
  for (const spot of spots) {
    const desks = distanceToShape(seat, spot.outline ?? [spot]) / deskWidth;
    const weight = timeWeight[spot.time];
    const score = zoneScore(desks, settings);
    nearest = Math.min(nearest, desks);
    best = Math.max(best, (score * weight) / fullTime);
    weighted += score * weight;
    totalWeight += weight;
  }
  const average = totalWeight > 0 ? weighted / totalWeight : 0;
  return {
    closeness: bestSpotShare * best + (1 - bestSpotShare) * average,
    desksFromTeacher: nearest,
    zone: zoneOf(nearest, settings),
  };
}
