import { useEffect, useState } from 'react';

/** A countdown in whole seconds, e.g. to make "Send a new code" wait between sends. */
export function useCooldown(seconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  return {
    active: secondsLeft > 0,
    secondsLeft,
    start: () => setSecondsLeft(seconds),
  };
}
