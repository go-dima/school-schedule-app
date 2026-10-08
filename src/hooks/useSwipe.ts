import { useRef } from "react";
import type { TouchEvent } from "react";

const MIN_DISTANCE = 50;
// Horizontal travel must clearly dominate, so vertical scrolling never
// turns into a swipe.
const MIN_RATIO = 1.5;

/**
 * Touch handlers that report a horizontal swipe on release: `onSwipeLeft`
 * when the finger moved right-to-left, `onSwipeRight` for left-to-right.
 * Spread the result onto the swipeable element.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
}: {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const from = start.current;
      const touch = e.changedTouches[0];
      start.current = null;
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dx) < Math.abs(dy) * MIN_RATIO) return;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    },
  };
}
