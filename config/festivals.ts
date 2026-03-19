// ─────────────────────────────────────────────
// SealedVow — Festival Config
// Controls homepage seasonal theming.
// Add a festival → it activates automatically
// when today falls within its dateRange.
// ─────────────────────────────────────────────

export type FestivalType = 'eid' | 'diwali' | 'christmas' | 'ramadan';

export type FestivalParticles = 'stars' | 'diyas' | 'snowflakes';
export type FestivalReveal    = 'scratch' | 'diya-light' | 'ribbon-unwrap';

export interface FestivalTheme {
  bg:      string;
  primary: string;
  accent:  string;
  banner:  string;
  glow:    string;
}

export interface FestivalCopy {
  banner:  string;
  heroCTA: string;
  heading: string;
  sub:     string;
  cta:     string;
}

export interface FestivalVisual {
  icon:      string;
  particles: FestivalParticles;
  reveal:    FestivalReveal;
  countdown: boolean;
}

export interface Festival {
  id:     string;
  name:   string;
  type:   FestivalType;
  start:  string;   // 'YYYY-MM-DD'
  end:    string;   // 'YYYY-MM-DD'
  route:  string;
  theme:  FestivalTheme;
  copy:   FestivalCopy;
  visual: FestivalVisual;
}

// ─────────────────────────────────────────────
// Default theme — shown when no festival active
// ─────────────────────────────────────────────

export const DEFAULT_THEME: FestivalTheme = {
  bg:      '#050505',
  primary: '#D4AF37',
  accent:  '#D4AF37',
  banner:  '#111111',
  glow:    'rgba(212,175,55,0.08)',
};

// ─────────────────────────────────────────────
// Festival Registry
// NOTE: Years are hardcoded — update dates each year.
// If two festivals overlap, first match wins.
// ─────────────────────────────────────────────

export const FESTIVALS: Festival[] = [
  {
    id:    'eid-ul-fitr-2026',
    name:  'Eid ul-Fitr 2026',
    type:  'eid',
    start: '2026-03-07',
    end:   '2026-03-31',
    route: '/create',

    theme: {
      bg:      '#050505',
      primary: '#1B4332',
      accent:  '#D4AF37',
      banner:  '#0f3d24',
      glow:    'rgba(27,67,50,0.4)',
    },

    copy: {
      banner:  '🌙 Eid Special — Send a Sealed Eidi to someone you love',
      heroCTA: 'Send Sealed Eidi 🌙',
      heading: 'Send a Sealed Eidi.',
      sub:     'A blessing. A surprise. A memory sealed forever.',
      cta:     'Create Sealed Eidi 🌙',
    },

    visual: {
      icon:      '🌙',
      particles: 'stars',
      reveal:    'scratch',
      countdown: true,
    },
  },

  // ── Coming Soon ───────────────────────────
  // {
  //   id:    'diwali-2026',
  //   name:  'Diwali 2026',
  //   start: '2026-10-15',
  //   end:   '2026-10-25',
  //   route: '/festivals/diwali',
  //   theme:  { bg: '#0A0500', primary: '#7C2D12', accent: '#F97316', banner: '#431407', glow: 'rgba(124,45,18,0.4)' },
  //   copy:   { banner: '🪔 Diwali Special — Send a Sealed Gift', heroCTA: 'Send Diwali Gift 🪔', heading: 'Light up someone\'s Diwali.', sub: 'A blessing wrapped in light.', cta: 'Create Diwali Gift 🪔' },
  //   visual: { icon: '🪔', particles: 'diyas', reveal: 'diya-light', countdown: true },
  // },
];

// ─────────────────────────────────────────────
// Auto-detect active festival based on today's date.
// Uses T00:00:00 suffix to avoid UTC timezone bugs.
// Returns null when no festival active →
// homepage falls back to DEFAULT_THEME.
// ─────────────────────────────────────────────

export function getActiveFestival(): Festival | null {
  const now = new Date();

  return FESTIVALS.find(f => {
    const start = new Date(f.start + 'T00:00:00');
    const end   = new Date(f.end   + 'T23:59:59');
    return now >= start && now <= end;
  }) ?? null;
}
