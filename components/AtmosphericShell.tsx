import React from 'react';

/**
 * AtmosphericShell — opt-in film-still texture wrapper for emotional scenes.
 *
 * Apply ONLY around: landing hero, envelope, letter reveal, Eidi pouch reveal,
 * exit whispers / closures. Never around forms, inputs, composers, payment,
 * or modals.
 */
export const AtmosphericShell: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="sv-surface-dark">
    <div className="sv-grain" aria-hidden="true" />
    <div className="sv-vignette" aria-hidden="true" />
    {children}
  </div>
);
