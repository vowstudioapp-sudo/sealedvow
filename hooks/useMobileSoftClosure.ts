import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * useMobileSoftClosure
 *
 * Scroll-based epilogue trigger for mobile receivers.
 *
 * Watches a scroll container (not window). When the user scrolls
 * past `threshold` (0–1) of total scrollable height and stops
 * scrolling for `delayMs`, fires once.
 *
 * Desktop (≥768px): no-op.
 * Preview mode: no-op.
 * Fires only once per mount.
 *
 * Returns `showSoftClosure` boolean.
 */

interface Options {
  /** Scroll container ref */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 0–1, default 0.92 */
  threshold?: number;
  /** ms to wait after scroll stops, default 2000 */
  delayMs?: number;
  /** Skip entirely (e.g. preview mode) */
  disabled?: boolean;
}

export function useMobileSoftClosure({
  containerRef,
  threshold = 0.92,
  delayMs = 2000,
  disabled = false,
}: Options) {
  const [showSoftClosure, setShowSoftClosure] = useState(false);
  const firedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled || firedRef.current) return;

    // Only mobile
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    const el = containerRef.current;
    if (!el) return;

    const cancelTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleScroll = () => {
      if (firedRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;

      const pct = scrollTop / maxScroll;

      if (pct >= threshold) {
        // User is in the zone — start delay timer
        // Every scroll event resets the timer (debounce)
        cancelTimer();
        timerRef.current = setTimeout(() => {
          if (firedRef.current) return;
          firedRef.current = true;
          setShowSoftClosure(true);
        }, delayMs);
      } else {
        // Scrolled back up — cancel
        cancelTimer();
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      cancelTimer();
    };
  }, [containerRef, threshold, delayMs, disabled]);

  // Lock body scroll when active
  useEffect(() => {
    if (!showSoftClosure) return;

    const el = containerRef.current;
    if (el) {
      el.style.overflow = 'hidden';
      el.style.scrollSnapType = 'none';
    }

    return () => {
      if (el) {
        el.style.overflow = '';
        el.style.scrollSnapType = '';
      }
    };
  }, [showSoftClosure, containerRef]);

  return showSoftClosure;
}