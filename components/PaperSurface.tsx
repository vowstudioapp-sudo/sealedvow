import React, { useMemo, useRef } from 'react';
import { Theme } from '../types';

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

const MATERIALS: Record<Theme, PaperMaterial> = {

  obsidian: {
    base: '#0F0D0C',
    drift: 'radial-gradient(ellipse at 30% 25%, rgba(28,20,14,0.010), transparent 75%), radial-gradient(ellipse at 75% 80%, rgba(0,0,0,0.012), transparent 70%)',
    fall: 'linear-gradient(to bottom, rgba(255,245,230,0.012), transparent 40%, rgba(0,0,0,0.055))',
    grainOpacity: 0.020,
    grainBlend: 'soft-light',
    edge: 'inset 0 0 190px rgba(0,0,0,0.45)',
  },

  velvet: {
    base: '#120E18',
    drift: 'radial-gradient(ellipse at 25% 20%, rgba(60,40,70,0.009), transparent 70%), radial-gradient(ellipse at 78% 82%, rgba(3,2,8,0.012), transparent 65%)',
    fall: 'linear-gradient(to bottom, rgba(150,130,170,0.010), transparent 40%, rgba(0,0,0,0.055))',
    grainOpacity: 0.018,
    grainBlend: 'soft-light',
    edge: 'inset 0 0 190px rgba(4,2,10,0.45)',
  },

  crimson: {
    base: '#1A0C0C',
    drift: 'radial-gradient(ellipse at 25% 30%, rgba(80,30,30,0.009), transparent 70%), radial-gradient(ellipse at 80% 75%, rgba(5,2,2,0.012), transparent 65%)',
    fall: 'linear-gradient(to bottom, rgba(170,120,110,0.010), transparent 40%, rgba(0,0,0,0.055))',
    grainOpacity: 0.019,
    grainBlend: 'overlay',
    edge: 'inset 0 0 190px rgba(8,3,3,0.45)',
  },

  midnight: {
    base: '#080C16',
    drift: 'radial-gradient(ellipse at 30% 22%, rgba(40,50,80,0.008), transparent 70%), radial-gradient(ellipse at 76% 82%, rgba(2,3,8,0.012), transparent 65%)',
    fall: 'linear-gradient(to bottom, rgba(130,145,180,0.010), transparent 40%, rgba(0,0,0,0.055))',
    grainOpacity: 0.018,
    grainBlend: 'soft-light',
    edge: 'inset 0 0 190px rgba(1,2,8,0.45)',
  },

  evergreen: {
    base: '#0C1713',
    drift: 'radial-gradient(ellipse at 28% 24%, rgba(30,55,40,0.009), transparent 70%), radial-gradient(ellipse at 78% 80%, rgba(2,6,4,0.012), transparent 65%)',
    fall: 'linear-gradient(to bottom, rgba(130,170,140,0.010), transparent 40%, rgba(0,0,0,0.055))',
    grainOpacity: 0.021,
    grainBlend: 'overlay',
    edge: 'inset 0 0 190px rgba(2,10,7,0.45)',
  },

  pearl: {
    base: '#161411',
    drift: 'radial-gradient(ellipse at 28% 22%, rgba(180,160,130,0.010), transparent 70%), radial-gradient(ellipse at 76% 80%, rgba(0,0,0,0.008), transparent 65%)',
    fall: 'linear-gradient(to bottom, rgba(230,220,200,0.014), transparent 40%, rgba(0,0,0,0.035))',
    grainOpacity: 0.022,
    grainBlend: 'soft-light',
    edge: 'inset 0 0 160px rgba(0,0,0,0.32)',
  },
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
  const mat = MATERIALS[theme];

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