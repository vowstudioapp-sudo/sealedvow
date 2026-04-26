import type { Theme } from '../types';

/** Shared neutrals used on top of vivid seal / CTA fills (single file source). */
export const UI_PALETTE = {
  onVividFill: '#FFFFFF',
  deepShadow: 'rgba(0,0,0,0.6)',
  subtleHint: 'rgba(255,255,255,0.5)',
  sealLiftShadow: 'rgba(0,0,0,0.4)',
  sealInsetDark: 'rgba(0,0,0,0.3)',
  sealInsetHighlight: 'rgba(255,255,255,0.15)',
  sealGlyphShadow: 'rgba(0,0,0,0.3)',
  dotElevation: '0 2px 8px rgba(0,0,0,0.3)',
  railMuted: 'rgba(255,255,255,0.1)',
  /** High-contrast copy on dark imagery (location + polaroid). */
  frost: '#FFFFFF',
  frost70: 'rgba(255,255,255,0.7)',
  frost60: 'rgba(255,255,255,0.6)',
  frost50: 'rgba(255,255,255,0.5)',
  frost30: 'rgba(255,255,255,0.3)',
  frost10: 'rgba(255,255,255,0.1)',
} as const;

export type ThemeSystemRow = {
  mode: 'dark' | 'light';
  bg: string;
  surface: string;
  /** Envelope face color */
  paper: string;
  /** PaperSurface / letter-stage base (may differ from envelope, e.g. pearl) */
  paperStage: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentRgb: string;
  border: string;
  seal: string;
  sealRgb: string;
  overlay: string;
  boardSurface: string;
  atmosphereGradient: string;
  surfaceSolid: string;
  sealGradient: string;
  sealText: string;
  particle: string;
  envelopeText: string;
  envelopeSubtext: string;
  paperDrift: string;
  paperFall: string;
  paperEdge: string;
  paperGrainOpacity: number;
  paperGrainBlend: 'overlay' | 'soft-light';
  accentSoft: string;
  locationCardGlow: string;
  modalBackdrop: string;
  modalSurface: string;
  modalClose: string;
  ctaSealHover: string;
};

function hexToRgbComma(hex: string): string | null {
  const m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function textRgbFromTheme(theme: ThemeSystemRow): string {
  return hexToRgbComma(theme.textPrimary) ?? '241,231,218';
}

export type CinematicLayer = {
  vignette: string;
  shadowStrength: string;
  glowStrength: number;
  overlayOpacity: number;
  transitionFlash: string;
  readability: {
    primary: string;
    secondary: string;
    muted: string;
  };
};

export function getCinematicLayer(theme: ThemeSystemRow): CinematicLayer {
  const textRgb = textRgbFromTheme(theme);
  const readability =
    theme.mode === 'light'
      ? {
          primary: theme.textPrimary,
          secondary: `rgba(${textRgb},0.75)`,
          muted: `rgba(${textRgb},0.55)`,
        }
      : {
          primary: theme.textPrimary,
          secondary: `rgba(${textRgb},0.7)`,
          muted: `rgba(${textRgb},0.5)`,
        };

  const transitionFlash =
    theme.mode === 'light' ? theme.paper : UI_PALETTE.onVividFill;

  if (theme.mode === 'light') {
    return {
      vignette:
        'radial-gradient(circle at center, transparent 62%, rgba(0,0,0,0.06) 100%)',
      shadowStrength: 'rgba(0,0,0,0.2)',
      glowStrength: 0.32,
      overlayOpacity: 0.9,
      transitionFlash,
      readability,
    };
  }
  return {
    vignette:
      'radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.16) 100%)',
    shadowStrength: 'rgba(0,0,0,0.55)',
    glowStrength: 1.12,
    overlayOpacity: 0.98,
    transitionFlash,
    readability,
  };
}

export const THEME_SYSTEM: Record<Theme, ThemeSystemRow> = {
  obsidian: {
    mode: 'dark',
    bg: '#0C0A09',
    surface: '#050505',
    paper: '#0A0A0A',
    paperStage: '#0F0D0C',
    textPrimary: '#E5D0A1',
    textSecondary: 'rgba(212,175,55,0.5)',
    accent: '#D4AF37',
    accentRgb: '212,175,55',
    border: '#D4AF37',
    seal: '#722F37',
    sealRgb: '114,47,55',
    overlay: 'rgba(0,0,0,0.7)',
    boardSurface: '#1C1917',
    atmosphereGradient:
      'linear-gradient(180deg, #0C0A09 0%, #1C1917 35%, #0C0A09 65%, #050505 100%)',
    surfaceSolid: '#050505',
    sealGradient: 'radial-gradient(circle at 30% 30%, #A83232, #582F2F)',
    sealText: 'rgba(255,255,255,0.8)',
    particle: '#D4AF37',
    envelopeText: '#E5D0A1',
    envelopeSubtext: 'rgba(212,175,55,0.5)',
    paperDrift:
      'radial-gradient(ellipse at 30% 25%, rgba(28,20,14,0.010), transparent 75%), radial-gradient(ellipse at 75% 80%, rgba(0,0,0,0.012), transparent 70%)',
    paperFall:
      'linear-gradient(to bottom, rgba(255,245,230,0.012), transparent 40%, rgba(0,0,0,0.055))',
    paperEdge: 'inset 0 0 190px rgba(0,0,0,0.45)',
    paperGrainOpacity: 0.02,
    paperGrainBlend: 'soft-light',
    accentSoft: 'rgba(212,175,55,0.5)',
    locationCardGlow: 'rgba(212,175,55,0.15)',
    modalBackdrop: 'rgba(0,0,0,0.8)',
    modalSurface: 'rgba(15,15,15,0.95)',
    modalClose: 'rgba(255,255,255,0.6)',
    ctaSealHover: '#5A1F27',
  },
  velvet: {
    mode: 'dark',
    bg: '#1A0B2E',
    surface: '#0F0520',
    paper: '#2E1065',
    paperStage: '#120E18',
    textPrimary: '#E9D5FF',
    textSecondary: '#D8B4FE',
    accent: '#C084FC',
    accentRgb: '192,132,252',
    border: '#C084FC',
    seal: '#7C3AED',
    sealRgb: '124,58,237',
    overlay: 'rgba(26,11,46,0.8)',
    boardSurface: '#2E1065',
    atmosphereGradient:
      'linear-gradient(180deg, #12081F 0%, #2E1F38 35%, #12081F 65%, #0A0510 100%)',
    surfaceSolid: '#1A0B2E',
    sealGradient: 'radial-gradient(circle at 30% 30%, #F59E0B, #B45309)',
    sealText: 'rgba(255,255,255,0.9)',
    particle: '#F59E0B',
    envelopeText: '#E9D5FF',
    envelopeSubtext: '#D8B4FE',
    paperDrift:
      'radial-gradient(ellipse at 25% 20%, rgba(60,40,70,0.009), transparent 70%), radial-gradient(ellipse at 78% 82%, rgba(3,2,8,0.012), transparent 65%)',
    paperFall:
      'linear-gradient(to bottom, rgba(150,130,170,0.010), transparent 40%, rgba(0,0,0,0.055))',
    paperEdge: 'inset 0 0 190px rgba(4,2,10,0.45)',
    paperGrainOpacity: 0.018,
    paperGrainBlend: 'soft-light',
    accentSoft: 'rgba(192,132,252,0.5)',
    locationCardGlow: 'rgba(192,132,252,0.15)',
    modalBackdrop: 'rgba(0,0,0,0.8)',
    modalSurface: 'rgba(15,15,15,0.95)',
    modalClose: 'rgba(255,255,255,0.6)',
    ctaSealHover: '#7C3AED',
  },
  crimson: {
    mode: 'dark',
    bg: '#2B0A0A',
    surface: '#1A0505',
    paper: '#881337',
    paperStage: '#1A0C0C',
    textPrimary: '#FECDD3',
    textSecondary: '#FDA4AF',
    accent: '#F43F5E',
    accentRgb: '244,63,94',
    border: '#FECDD3',
    seal: '#9F1239',
    sealRgb: '159,18,57',
    overlay: 'rgba(43,10,10,0.8)',
    boardSurface: '#3B0A0A',
    atmosphereGradient:
      'linear-gradient(180deg, #1A0505 0%, #3D1018 35%, #1A0505 65%, #0F0303 100%)',
    surfaceSolid: '#2B0A0A',
    sealGradient: 'radial-gradient(circle at 30% 30%, #4C0519, #881337)',
    sealText: 'rgba(255,255,255,0.8)',
    particle: '#FECDD3',
    envelopeText: '#FFF1F2',
    envelopeSubtext: '#FDA4AF',
    paperDrift:
      'radial-gradient(ellipse at 25% 30%, rgba(80,30,30,0.009), transparent 70%), radial-gradient(ellipse at 80% 75%, rgba(5,2,2,0.012), transparent 65%)',
    paperFall:
      'linear-gradient(to bottom, rgba(170,120,110,0.010), transparent 40%, rgba(0,0,0,0.055))',
    paperEdge: 'inset 0 0 190px rgba(8,3,3,0.45)',
    paperGrainOpacity: 0.019,
    paperGrainBlend: 'overlay',
    accentSoft: 'rgba(244,63,94,0.5)',
    locationCardGlow: 'rgba(244,63,94,0.15)',
    modalBackdrop: 'rgba(0,0,0,0.8)',
    modalSurface: 'rgba(15,15,15,0.95)',
    modalClose: 'rgba(255,255,255,0.6)',
    ctaSealHover: '#9F1239',
  },
  midnight: {
    mode: 'dark',
    bg: '#020617',
    surface: '#010410',
    paper: '#172554',
    paperStage: '#080C16',
    textPrimary: '#E0F2FE',
    textSecondary: '#60A5FA',
    accent: '#7DD3FC',
    accentRgb: '125,211,252',
    border: '#93C5FD',
    seal: '#1E40AF',
    sealRgb: '30,64,175',
    overlay: 'rgba(2,6,23,0.8)',
    boardSurface: '#0F172A',
    atmosphereGradient:
      'linear-gradient(180deg, #010410 0%, #0F1C3A 35%, #010410 65%, #000208 100%)',
    surfaceSolid: '#0F172A',
    sealGradient: 'radial-gradient(circle at 30% 30%, #94A3B8, #475569)',
    sealText: 'rgba(255,255,255,0.95)',
    particle: '#93C5FD',
    envelopeText: '#EFF6FF',
    envelopeSubtext: '#60A5FA',
    paperDrift:
      'radial-gradient(ellipse at 30% 22%, rgba(40,50,80,0.008), transparent 70%), radial-gradient(ellipse at 76% 82%, rgba(2,3,8,0.012), transparent 65%)',
    paperFall:
      'linear-gradient(to bottom, rgba(130,145,180,0.010), transparent 40%, rgba(0,0,0,0.055))',
    paperEdge: 'inset 0 0 190px rgba(1,2,8,0.45)',
    paperGrainOpacity: 0.018,
    paperGrainBlend: 'soft-light',
    accentSoft: 'rgba(125,211,252,0.5)',
    locationCardGlow: 'rgba(125,211,252,0.15)',
    modalBackdrop: 'rgba(0,0,0,0.8)',
    modalSurface: 'rgba(15,15,15,0.95)',
    modalClose: 'rgba(255,255,255,0.6)',
    ctaSealHover: '#172554',
  },
  evergreen: {
    mode: 'dark',
    bg: '#022C22',
    surface: '#011A14',
    paper: '#022C22',
    paperStage: '#0C1713',
    textPrimary: '#D1FAE5',
    textSecondary: '#D97706',
    accent: '#34D399',
    accentRgb: '52,211,153',
    border: '#B45309',
    seal: '#065F46',
    sealRgb: '6,95,70',
    overlay: 'rgba(2,44,34,0.8)',
    boardSurface: '#064E3B',
    atmosphereGradient:
      'linear-gradient(180deg, #011A14 0%, #064E3B 35%, #011A14 65%, #000D0A 100%)',
    surfaceSolid: '#022C22',
    sealGradient: 'radial-gradient(circle at 30% 30%, #D97706, #92400E)',
    sealText: 'rgba(255,255,255,0.85)',
    particle: '#D97706',
    envelopeText: '#ECFDF5',
    envelopeSubtext: '#D97706',
    paperDrift:
      'radial-gradient(ellipse at 28% 24%, rgba(30,55,40,0.009), transparent 70%), radial-gradient(ellipse at 78% 80%, rgba(2,6,4,0.012), transparent 65%)',
    paperFall:
      'linear-gradient(to bottom, rgba(130,170,140,0.010), transparent 40%, rgba(0,0,0,0.055))',
    paperEdge: 'inset 0 0 190px rgba(2,10,7,0.45)',
    paperGrainOpacity: 0.021,
    paperGrainBlend: 'overlay',
    accentSoft: 'rgba(52,211,153,0.5)',
    locationCardGlow: 'rgba(52,211,153,0.15)',
    modalBackdrop: 'rgba(0,0,0,0.8)',
    modalSurface: 'rgba(15,15,15,0.95)',
    modalClose: 'rgba(255,255,255,0.6)',
    ctaSealHover: '#065F46',
  },
  pearl: {
    mode: 'light',
    bg: '#1C1917',
    surface: '#0C0A09',
    paper: '#FAFAFA',
    paperStage: '#161411',
    textPrimary: '#F5F5F4',
    textSecondary: '#A8A29E',
    accent: '#A8A29E',
    accentRgb: '168,162,158',
    border: '#D4AF37',
    seal: '#57534E',
    sealRgb: '87,83,78',
    overlay: 'rgba(28,25,23,0.8)',
    boardSurface: '#292524',
    atmosphereGradient:
      'linear-gradient(180deg, #141210 0%, #292524 35%, #141210 65%, #0C0A09 100%)',
    surfaceSolid: '#FFFFFF',
    sealGradient: 'radial-gradient(circle at 30% 30%, #E7E5E4, #A8A29E)',
    sealText: 'rgba(255,255,255,1)',
    particle: '#D4AF37',
    envelopeText: '#44403C',
    envelopeSubtext: '#A8A29E',
    paperDrift:
      'radial-gradient(ellipse at 28% 22%, rgba(180,160,130,0.010), transparent 70%), radial-gradient(ellipse at 76% 80%, rgba(0,0,0,0.008), transparent 65%)',
    paperFall:
      'linear-gradient(to bottom, rgba(230,220,200,0.014), transparent 40%, rgba(0,0,0,0.035))',
    paperEdge: 'inset 0 0 160px rgba(0,0,0,0.32)',
    paperGrainOpacity: 0.022,
    paperGrainBlend: 'soft-light',
    accentSoft: 'rgba(168,162,158,0.5)',
    locationCardGlow: 'rgba(168,162,158,0.15)',
    modalBackdrop: 'rgba(0,0,0,0.8)',
    modalSurface: 'rgba(15,15,15,0.95)',
    modalClose: 'rgba(255,255,255,0.6)',
    ctaSealHover: '#44403C',
  },
};

export type ExperienceTheme = {
  bg: string;
  text: string;
  gold: string;
  overlay: string;
  boardBg: string;
  sectionBg: string;
  sealColor: string;
};

export function experienceTheme(theme: Theme | undefined): ExperienceTheme {
  const t = THEME_SYSTEM[theme ?? 'obsidian'] ?? THEME_SYSTEM.obsidian;
  return {
    bg: t.bg,
    text: t.textPrimary,
    gold: t.accent,
    overlay: t.overlay,
    boardBg: t.boardSurface,
    sectionBg: t.surface,
    sealColor: t.seal,
  };
}

export type EnvelopeThemeStyles = {
  paper: string;
  border: string;
  text: string;
  subtext: string;
  seal: string;
  sealText: string;
  particle: string;
};

export function envelopeStylesFromTheme(theme: Theme | undefined): EnvelopeThemeStyles {
  const t = THEME_SYSTEM[theme ?? 'obsidian'] ?? THEME_SYSTEM.obsidian;
  return {
    paper: t.paper,
    border: t.border,
    text: t.envelopeText,
    subtext: t.envelopeSubtext,
    seal: t.sealGradient,
    sealText: t.sealText,
    particle: t.particle,
  };
}

export type IqTheme = {
  bg: string;
  text: string;
  gold: string;
  seal: string;
  goldRgb: string;
  sealRgb: string;
};

export function iqThemeFromSystem(theme: Theme | undefined): IqTheme {
  const t = THEME_SYSTEM[theme ?? 'obsidian'] ?? THEME_SYSTEM.obsidian;
  return {
    bg: t.bg,
    text: t.textPrimary,
    gold: t.accent,
    seal: t.seal,
    goldRgb: t.accentRgb,
    sealRgb: t.sealRgb,
  };
}

export const THEME_LABELS: Record<
  Theme,
  { label: string; description: string; shortName: string }
> = {
  obsidian: {
    label: 'Obsidian & Gold',
    description: 'Timeless, Bold, Classic',
    shortName: 'Obsidian',
  },
  velvet: {
    label: 'Royal Velvet',
    description: 'Deep, Mysterious, Spiritual',
    shortName: 'Velvet',
  },
  crimson: {
    label: 'Desert Rose',
    description: 'Passionate, Warm, Romantic',
    shortName: 'Crimson',
  },
  midnight: {
    label: 'Midnight Blue',
    description: 'Celestial, Infinite, Calm',
    shortName: 'Midnight',
  },
  evergreen: {
    label: 'Forest Bronze',
    description: 'Natural, Grounded, Eternal',
    shortName: 'Evergreen',
  },
  pearl: {
    label: 'Ethereal Pearl',
    description: 'Pure, Delicate, Divine',
    shortName: 'Pearl',
  },
};

export const THEME_ORDER: Theme[] = [
  'obsidian',
  'velvet',
  'crimson',
  'midnight',
  'evergreen',
  'pearl',
];
