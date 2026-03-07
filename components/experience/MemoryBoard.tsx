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

  const dragStartPos = useRef({ x: 0, y: 0 });
  const maxZ = useRef(20);
  // Stable ref for dragging index to avoid recreating pointer handlers
  const draggingIdxRef = useRef<number | null>(null);

  // Rehydrate interactive photos if parent passes new photos array
  // (e.g. edit mode, preview regeneration, data reload).
  // Without this, extracted component would show stale photos after prop change.
  useEffect(() => {
    setInteractivePhotos(
      photos.map((p, i) => ({
        ...p,
        dragX: 0,
        dragY: 0,
        zIndex: 10 + i,
      }))
    );
    maxZ.current = 20;
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

  /* ── Render ── */
  return (
    <section
      className="snap-section min-h-[100vh] w-full relative flex flex-col items-center justify-center snap-start overflow-hidden py-32"
      style={{ backgroundColor: theme.boardBg }}
    >
      <div className="main-experience-board-texture" />

      <div className="main-experience-board-header">
        <h2 className="text-[10px] uppercase tracking-[0.5em] font-bold mb-2" style={{ color: theme.gold, opacity: 0.6 }}>A beautiful mess</h2>
        <h1 className="text-3xl md:text-5xl font-serif-elegant italic mb-3" style={{ color: theme.text }}>Fragments of Us</h1>
        <p className="text-[9px] uppercase tracking-widest font-bold animate-pulse" style={{ color: theme.gold, opacity: 0.5 }}>Tap and drag to explore</p>
      </div>

      <div className="relative w-full max-w-4xl h-[70vh] flex items-center justify-center mt-12">
        {interactivePhotos.map((photo, idx) => {
          const isDragging = draggingIdx === idx;
          return (
            <div
              key={idx}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              className={`main-experience-photo ${isDragging ? 'main-experience-photo--dragging' : ''}`}
              style={{
                '--photo-offset-x': `${photo.xOffset}px`,
                '--photo-offset-y': `${photo.yOffset}px`,
                '--photo-drag-x': `${photo.dragX}px`,
                '--photo-drag-y': `${photo.dragY}px`,
                '--photo-angle': `${photo.angle}deg`,
                '--photo-scale': isDragging ? 1.05 : 1,
                zIndex: photo.zIndex,
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