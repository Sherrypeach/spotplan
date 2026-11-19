// Every number the engine uses, in one place so they can be tuned without
// touching the rules. Starting values, tuned by eye against the worked example's
// worked example. Distances are in desk widths unless noted.

/** The drawing units the room and layouts use: a desk is this many wide. Some limits below are given in them. */
export const UNITS_PER_DESK = 72.4;

export const DEFAULT_SETTINGS = {
  neighbors: {
    // Chairs this close count as neighbors: a multiple of the layout's usual
    // gap between neighboring seats, kept within a minimum and maximum.
    chairGapFactor: 1.25,
    minChairGap: 60 / UNITS_PER_DESK,
    maxChairGap: 118 / UNITS_PER_DESK,
    // Desks that touch make neighbors only when the students sit face to face
    // (facing opposite ways, offset less than this) or side by side.
    faceToFaceOffset: 0.75,
    sideBySideOffset: 1.6,
    // How the facing of two seats compares: 1 = same way, -1 = opposite ways,
    // 0 = right angle. Opposite or same way means within about 45 degrees.
    oppositeAlignment: -0.7,
    sameWayAlignment: 0.7,
    // Below this (in either direction) the students sit at a right angle.
    rightAngleAlignment: 0.35,
    // How far apart touching pieces can be and still count as touching.
    touchGap: 0.06,
    // Seats this close that aren't neighbors count as "close" (keep-apart pairs,
    // spreading out 1s).
    closeDistance: 2.2,
  },
  facing: {
    // 1 = straight at the board, 0 = sideways, -1 = the back wall.
    facesFrontAt: 0.6,
  },
  groups: { minSeats: 3, maxSeats: 10 },
  ranking: {
    // Seats less than this far apart front to back (or from the door) rank as
    // equals, like seats in one row.
    sameRowDesks: 0.3,
  },
  closeness: {
    greenDesks: 2.5,
    yellowDesks: 5,
    yellowScore: 0.35,
    // Past the yellow zone the score fades by half over this many desks.
    redFadeDesks: 2.5,
    timeWeight: { most: 3, sometimes: 2, 'not-much': 0 },
    // A seat's score: this share from the teacher's best spot, the rest from
    // the time-weighted average of all spots.
    bestSpotShare: 0.65,
    // A 2 beside a 1 counts as far from the teacher when their average
    // closeness is below this.
    farBelow: 0.5,
  },
  labels: {
    onesExtraShare: 0.15,
    onesShareWithoutRoster: 0.2,
    twosShareWithoutRoster: 0.25,
    // Most 1 seats a group can have, by group size.
    groupCaps: [
      { maxSeats: 3, cap: 1 },
      { maxSeats: 7, cap: 2 },
      { maxSeats: Infinity, cap: 3 },
    ],
    // Starting values for these two; the seating guide names them but not their size.
    twoBesideOneSeatPenalty: 0.3,
    twoClumpPenalty: 0.05,
  },
  needWeight: { must: 2.2, nice: 0.35 },
  cost: {
    oneInTwoSeat: 40,
    oneInThreeSeat: 90,
    twoInThreeSeat: 38,
    twoInOneSeat: 3,
    threeInOneSeat: 5,
    threeInTwoSeat: 1,
    onesSideBySide: 60,
    keepApartNextTo: 220,
    keepApartSameTable: 70,
    keepApartClose: 35,
    oneBesideTwo: 6,
    oneBesideTwoFar: 14,
    helperMissing: 28,
    groupWithoutThree: 16,
    groupExtraOne: 8,
    sameColorNeighbors: 3.5,
    groupColorOff: 5,
    groupColorSlack: 0.75,
    nearFront: 55,
    nearFrontFreeShare: 0.25,
    faceFrontMin: 30,
    faceFrontMax: 60,
    closeToMe: 55,
    closeToMeFreeShare: 0.12,
    nearDoor: 55,
    nearDoorFreeShare: 0.2,
    fewerNeighborsEach: 6,
    fewerNeighborsPair: 4,
  },
  history: {
    // Shuffling away from the chart on screen.
    current: { sameSeat: 32, sameNeighbor: 10, sameBuffer: 6 },
    // The last two saved charts in the same layout, newest first.
    saved: [
      { sameSeat: 16, sameNeighbor: 6, sameBuffer: 4 },
      { sameSeat: 7, sameNeighbor: 3, sameBuffer: 2 },
    ],
  },
  feedback: {
    spreadOnesPerLevel: 14,
    onesCloserPerLevel: 30,
    fewerOnesExtraOne: [22, 36],
  },
  checklist: {
    tierWeight: { attention: 10, look: 3, minorLook: 1, nice: 1 },
    nearFrontShare: 0.4,
    closeToMeShare: 0.3,
    nearDoorShare: 0.35,
    fewerNeighborsMax: 2,
  },
  search: {
    movesPerStudent: 2600,
    minMoves: 24000,
    maxMoves: 130000,
    runs: 3,
    startTemperature: 25,
    endTemperature: 0.05,
    // Shuffles add a little random preference per student and seat so each
    // one comes out different.
    shuffleNoise: 2,
  },
};

export type EngineSettings = typeof DEFAULT_SETTINGS;
