import type { Theme } from '../types';
import {
  envelopeStylesFromTheme,
  type EnvelopeThemeStyles,
} from '../theme/themeSystem';

export type { EnvelopeThemeStyles };

export const ENVELOPE_STYLES: Record<Theme, EnvelopeThemeStyles> = {
  obsidian: envelopeStylesFromTheme('obsidian'),
  velvet: envelopeStylesFromTheme('velvet'),
  crimson: envelopeStylesFromTheme('crimson'),
  midnight: envelopeStylesFromTheme('midnight'),
  evergreen: envelopeStylesFromTheme('evergreen'),
  pearl: envelopeStylesFromTheme('pearl'),
};
