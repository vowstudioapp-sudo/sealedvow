import React, { useMemo } from 'react';
import type { Theme } from '../types';
import { getCinematicLayer, THEME_SYSTEM } from '../theme/themeSystem';

type Props = React.PropsWithChildren<{
  /** When set, replaces the fixed plum sv-surface-dark gradient with this theme. */
  surfaceTheme?: Theme;
  /**
   * `gradient` = film-style vertical wash (letter, landing hero).
   * `solid` = flat theme color — use behind a centered object (e.g. seal card).
   */
  surfaceBackground?: 'gradient' | 'solid';
}>;

/**
 * AtmosphericShell — opt-in film-still texture wrapper for emotional scenes.
 *
 * Apply ONLY around: landing hero, envelope, letter reveal, Eidi pouch reveal,
 * exit whispers / closures. Never around forms, inputs, composers, payment,
 * or modals.
 */
export const AtmosphericShell: React.FC<Props> = ({
  children,
  surfaceTheme,
  surfaceBackground = 'gradient',
}) => {
  const themedBackground =
    surfaceTheme !== undefined
      ? surfaceBackground === 'solid'
        ? THEME_SYSTEM[surfaceTheme]?.surfaceSolid ??
          THEME_SYSTEM.obsidian.surfaceSolid
        : THEME_SYSTEM[surfaceTheme]?.atmosphereGradient ??
          THEME_SYSTEM.obsidian.atmosphereGradient
      : undefined;

  const cinematic = useMemo(() => {
    if (surfaceTheme === undefined) return null;
    const row = THEME_SYSTEM[surfaceTheme] ?? THEME_SYSTEM.obsidian;
    return getCinematicLayer(row);
  }, [surfaceTheme]);

  return (
    <div
      className="sv-surface-dark"
      style={themedBackground !== undefined ? { background: themedBackground } : undefined}
    >
      <div className="sv-grain" aria-hidden="true" />
      {cinematic !== null && (
        <div
          className="sv-cinematic-vignette"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background: cinematic.vignette,
          }}
        />
      )}
      {children}
    </div>
  );
};
