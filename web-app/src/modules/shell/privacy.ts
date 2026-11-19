import { createContext, useContext } from 'react';

export type PrivacyValue = {
  /** Levels, needs and notes are hidden, e.g. while the screen is projected. */
  hidden: boolean;
  toggle: () => void;
};

export const PrivacyContext = createContext<PrivacyValue>({ hidden: false, toggle: () => {} });

export function usePrivacy(): PrivacyValue {
  return useContext(PrivacyContext);
}
