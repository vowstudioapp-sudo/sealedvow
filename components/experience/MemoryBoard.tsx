/**
 * MemoryBoard — Interactive draggable photo board.
 *
 * Owns: all drag state, pointer event listeners, photo z-ordering.
 * Parent interface: onDragStart/onDragEnd callbacks for scroll lock.
 * Does NOT receive containerRef — parent owns scroll container behavior.
 *
 * Extracted from MainExperience.tsx — zero logic changes.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MemoryPhoto } from '../../types';

interface InteractivePhoto extends MemoryPhoto {
  dragX: number;
  dragY: number;
  zIndex: number;
}

interface MemoryBoardProps {
  photos: MemoryPhoto[];
  theme: {
    gold: string;
    text: string;
    boardBg: string;
  };
  /** Called when user starts dragging a photo. Parent should lock scroll. */
  onDragStart?: () => void;
  /** Called when user stops dragging. Parent should restore scroll. */
  onDragEnd?: () => void;
}

export const MemoryBoard: React.FC<MemoryBoardProps> = ({
  photos,
  theme,
  onDragStart,
  onDragEnd,
}) => {
  const [interactivePhotos, setInteractivePhotos] = useState<InteractivePhoto[]>(
    photos.map((p, i) => ({
      ...p,
      dragX: 0,
      dragY: 0,
      zIndex: 10 + i,
    }))
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // Passive-witness spotlight: one polaroid highlighted at a time, advances
  // every 3.5s while the section is in view and no drag is active.
  const [activeIdx, setActiveIdx] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [layoutRevealed, setLayoutRevealed] = useState(false);
  const [hasUnfolded, setHasUnfolded] = useState(false);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const unfoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unfoldScheduledRef = useRef(false);
  const maxZ = useRef(20);
  // Stable ref for dragging index to avoid recreating pointer handlers
  const draggingIdxRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  // Rehydrate interactive photos if parent passes new photos array
  // (e.g. edit mode, preview regeneration, data reload).
  // Without this, extracted component would show stale photos after prop change.
  useEffect(() => {
    if (unfoldTimerRef.current) {
      clearTimeout(unfoldTimerRef.current);
      unfoldTimerRef.current = null;
    }
    unfoldScheduledRef.current = false;
    setInteractivePhotos(
      photos.map((p, i) => ({
        ...p,
        dragX: 0,
        dragY: 0,
        zIndex: 10 + i,
      }))
    );
    maxZ.current = 20;
    setLayoutRevealed(false);
    setHasUnfolded(false);
  }, [photos]);

  /* ── Pointer Event Handlers (Stable References) ── */
  useEffect(() => {
    draggingIdxRef.current = draggingIdx;

    if (draggingIdx === null) {
      onDragEnd?.();
      return;
    }

    const handleMove = (e: PointerEvent) => {
      e.preventDefault();

      const currentIdx = draggingIdxRef.current;
      if (currentIdx === null) return;

      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      setInteractivePhotos(prev => {
        const next = [...prev];
        if (currentIdx !== null && next[currentIdx]) {
          next[currentIdx] = {
            ...next[currentIdx],
            dragX: next[currentIdx].dragX + dx,
            dragY: next[currentIdx].dragY + dy,
          };
        }
        return next;
      });

      dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleUp = () => {
      setDraggingIdx(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      // If component unmounts mid-drag (navigation, exit overlay, conditional
      // render change), parent scroll may stay locked. Always notify parent.
      onDragEnd?.();
    };
  }, [draggingIdx, onDragEnd]);

  /* ── Spotlight: visibility observer ── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isActive || layoutRevealed) return;
    setLayoutRevealed(true);
  }, [isActive, layoutRevealed]);

  useEffect(() => {
    if (!layoutRevealed || hasUnfolded) return;
    if (unfoldScheduledRef.current) return;

    unfoldScheduledRef.current = true;
    const staggerMs = 80;
    const perPhotoMs = 900;
    const totalMs =
      photos.length <= 0 ? perPhotoMs : (photos.length - 1) * staggerMs + perPhotoMs;

    unfoldTimerRef.current = setTimeout(() => {
      unfoldTimerRef.current = null;
      setHasUnfolded(true);
    }, totalMs);
  }, [layoutRevealed, hasUnfolded, photos.length]);

  useEffect(() => {
    return () => {
      if (unfoldTimerRef.current) {
        clearTimeout(unfoldTimerRef.current);
        unfoldTimerRef.current = null;
      }
    };
  }, []);

  /* ── Spotlight: drag-induced pause / 2s resume window ── */
  useEffect(() => {
    if (draggingIdx !== null) {
      pausedRef.current = true;
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    } else if (pausedRef.current) {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
      }
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
        resumeTimerRef.current = null;
      }, 2000);
    }
  }, [draggingIdx]);

  /* ── Spotlight: cycle interval (gated by visibility) ── */
  useEffect(() => {
    if (!isActive || !hasUnfolded) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      pausedRef.current = true;
      return;
    }

    pausedRef.current = false;

    if (photos.length <= 1) return;

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      if (draggingIdxRef.current !== null) return;
      setActiveIdx(prev => (prev + 1) % photos.length);
    }, 3500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [photos.length, isActive, hasUnfolded]);

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    maxZ.current += 1;

    setDraggingIdx(idx);
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    setInteractivePhotos(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], zIndex: maxZ.current };
      return next;
    });

    onDragStart?.();
  }, [onDragStart]);

  console.log('[MB]', { isActive, layoutRevealed, hasUnfolded });

  /* ── Render ── */
  return (
    <section
      ref={sectionRef}
      className="snap-section min-h-[100vh] w-full relative flex flex-col items-center justify-center snap-start overflow-hidden py-32"
      style={{ backgroundColor: theme.boardBg }}
    >
      <div className="main-experience-board-texture" />

      <div className="main-experience-board-header">
        <h2 className="text-[10px] uppercase tracking-[0.5em] font-bold mb-2" style={{ color: theme.gold, opacity: 0.6 }}>A beautiful mess</h2>
        <h1 className="text-3xl md:text-5xl font-serif-elegant italic mb-3" style={{ color: theme.text }}>Fragments of Us</h1>
      </div>

      <div className="relative w-full max-w-4xl h-[70vh] flex items-center justify-center mt-12">
        {interactivePhotos.map((photo, idx) => {
          const isDragging = draggingIdx === idx;
          const isSpotlight = idx === activeIdx;
          return (
            <div
              key={idx}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              className={`main-experience-photo ${isDragging ? 'main-experience-photo--dragging' : ''}`}
              style={{
                '--photo-offset-x': layoutRevealed ? `${photo.xOffset}px` : '0px',
                '--photo-offset-y': layoutRevealed ? `${photo.yOffset}px` : '0px',
                '--photo-drag-x': `${photo.dragX}px`,
                '--photo-drag-y': `${photo.dragY}px`,
                '--photo-angle': `${photo.angle}deg`,
                '--photo-scale': isDragging ? 1.05 : (isSpotlight ? 1.15 : 0.94),
                '--photo-transition-duration': hasUnfolded ? '0.4s' : '0.9s',
                opacity: isDragging ? 1 : (isSpotlight ? 1 : 0.35),
                transitionDelay: layoutRevealed && !hasUnfolded ? `${idx * 80}ms` : '0ms',
                zIndex: isSpotlight ? 9999 : photo.zIndex,
              } as React.CSSProperties}
            >
              <div className="main-experience-photo-img">
                <img src={photo.url} className="w-full h-full object-cover grayscale-[0.2]" alt="Memory" draggable="false" loading="lazy" />
              </div>
              <div className="main-experience-photo-caption font-serif-elegant">
                {photo.caption || ''}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};