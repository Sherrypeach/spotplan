import { createContext, useContext } from 'react';

export type TourValue = {
  /** Starts the tour from its first stop. */
  start: () => void;
  /** Whether it can run now: only with a class open on screen. */
  available: boolean;
};

export const TourContext = createContext<TourValue>({ start: () => {}, available: false });

export function useTour(): TourValue {
  return useContext(TourContext);
}
