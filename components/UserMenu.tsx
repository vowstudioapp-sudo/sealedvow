import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

interface Props {
  user: User;
  onOpenLetters: () => void;
  onSignOut: () => void | Promise<void>;
}

function getInitials(user: User): string {
  const name = user.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0]) return parts[0][0].toUpperCase();
  }
  const email = user.email?.trim();
  if (email) return email[0].toUpperCase();
  return '?';
}

export const UserMenu: React.FC<Props> = ({ user, onOpenLetters, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const initials = getInitials(user);
  const displayName = user.displayName || user.email || 'Account';

  return (
    <div className="lp-usermenu" ref={containerRef}>
      <button
        className="lp-usermenu__trigger"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
      >
        {initials}
      </button>

      {isOpen && (
        <div className="lp-usermenu__panel" role="menu">
          <div className="lp-usermenu__identity">
            <div className="lp-usermenu__name">{displayName}</div>
            {user.email && (
              <div className="lp-usermenu__email">{user.email}</div>
            )}
          </div>

          <div className="lp-usermenu__divider" />

          <button
            className="lp-usermenu__item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onOpenLetters();
            }}
          >
            Letters
          </button>

          <div className="lp-usermenu__divider" />

          <button
            className="lp-usermenu__item lp-usermenu__item--quiet"
            role="menuitem"
            onClick={async () => {
              setIsOpen(false);
              await onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
