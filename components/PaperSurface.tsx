import React, { useMemo, useRef } from 'react';
import { Theme } from '../types';
import { THEME_SYSTEM } from '../theme/themeSystem';

/* ------------------------------------------------------------------ */
/* SIX LUXURY PAPER MATERIALS                                          */
/*                                                                     */
/* 85% light absorption · 10% organic fiber · 5% temperature shift     */
/*                                                                     */
/* Obsidian  → Private archive                                         */
/* Velvet    → Late evening letter                                     */
/* Crimson   → Candlelit confession                                    */
/* Midnight  → Ink room at night                                       */
/* Evergreen → Conservatory study                                      */
/* Pearl     → Handwritten ivory stationery                            */
/* ------------------------------------------------------------------ */

interface PaperMaterial {
  base: string;
  drift: string;
  fall: string;
  grainOpacity: number;
  grainBlend: 'overlay' | 'soft-light';
  edge: string;
}

const materialFromSystem = (theme: Theme): PaperMaterial => {
  const t = THEME_SYSTEM[theme] ?? THEME_SYSTEM.obsidian;
  return {
    base: t.paperStage,
    drift: t.paperDrift,
    fall: t.paperFall,
    grainOpacity: t.paperGrainOpacity,
    grainBlend: t.paperGrainBlend,
    edge: t.paperEdge,
  };
};

/* ------------------------------------------------------------------ */
/* GRAIN                                                               */
/*                                                                     */
/* baseFrequency 0.65 — denser than 0.9, less digital shimmer          */
/* numOctaves 3 — more organic layering                                */
/* 200px tile with random offset — kills tiling detection              */
/* ------------------------------------------------------------------ */

const GRAIN_SVG = (() => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)" opacity="0.5"/></svg>';
  if (typeof btoa === 'function') {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
})();

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  theme: Theme;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section';
}

export const PaperSurface: React.FC<Props> = ({
  theme,
  children,
  className = '',
  style = {},
  as: Tag = 'div',
}) => {
  const mat = useMemo(() => materialFromSystem(theme), [theme]);

  const grainOffset = useRef(
    `${Math.floor(Math.random() * 50 + 11)}px ${Math.floor(Math.random() * 50 + 11)}px`
  );

  const bg = useMemo(
    () => [mat.drift, mat.fall].join(', '),
    [mat.drift, mat.fall]
  );

  return (
    <Tag
      className={className}
      style={{ position: 'relative', backgroundColor: mat.base, backgroundImage: bg, ...style }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${GRAIN_SVG}")`,
          backgroundSize: '200px 200px',
          backgroundRepeat: 'repeat',
          backgroundPosition: grainOffset.current,
          opacity: mat.grainOpacity,
          mixBlendMode: mat.grainBlend,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: mat.edge,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {children}
    </Tag>
  );
};
