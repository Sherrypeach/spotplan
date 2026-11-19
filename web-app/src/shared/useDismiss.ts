import { useEffect, type RefObject } from 'react';

/**
 * While `open`, a press outside `ref`, focus moving outside it, or Escape
 * calls `onDismiss` (with `byEscape` so the caller can return focus).
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onDismiss: (byEscape: boolean) => void): void {
  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => !(target instanceof Node && ref.current?.contains(target));
    const onPointer = (event: PointerEvent) => {
      if (outside(event.target)) onDismiss(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (outside(event.target)) onDismiss(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss(true);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onDismiss]);
}
