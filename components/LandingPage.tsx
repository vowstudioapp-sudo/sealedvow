import React, { useEffect, useRef, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';
import { HelpModal } from './HelpModal';
import { MyLettersModal } from './MyLettersModal';
import { UserMenu } from './UserMenu';
import { useAuth } from '../hooks/useAuth';

interface Props {
  onEnter: () => void;
}

export const LandingPage: React.FC<Props> = ({ onEnter }) => {
  const [isVisible,   setIsVisible]   = useState(false);
  const [isEntering,  setIsEntering]  = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms,   setShowTerms]   = useState(false);
  const [showHelp,    setShowHelp]    = useState(false);
  const [showLogin,   setShowLogin]   = useState(false);
  const [emailInput,  setEmailInput]  = useState('');
  const [pastHero,    setPastHero]    = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showMyLetters, setShowMyLetters] = useState(false);

  const { user, signInWithGoogle, signOut } = useAuth();

  const intervalRef  = useRef<number | null>(null);
  const heroRef      = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const demoRef      = useRef<HTMLElement | null>(null);
  const glowRef      = useRef<HTMLDivElement | null>(null);
  const railMaskRef  = useRef<HTMLDivElement | null>(null);

  /* ── Entrance reveal ── */
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  /* ── Past-hero detection — shows the Create CTA in navbar ── */
  useEffect(() => {
    const handleScroll = () => {
      const hero = heroRef.current;
      if (!hero) return;
      setPastHero(hero.getBoundingClientRect().bottom <= 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      if (container) container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /* ── Scroll fade-in ── */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    document.querySelectorAll('.lp-fade').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [isVisible]);

  /* ── Cinematic progress ── */
  useEffect(() => {
    if (!isEntering) return;
    let current = 0;
    intervalRef.current = window.setInterval(() => {
      current += (100 - current) * 0.12;
      if (current >= 99) {
        current = 100;
        setProgress(100);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(onEnter, 600);
        return;
      }
      setProgress(current);
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isEntering, onEnter]);

  /* ── ESC to close modal ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogin(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* ── Lock scroll when modal open ── */
  useEffect(() => {
    document.body.style.overflow = showLogin ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showLogin]);

  /* ── 3D card tilt + cursor light ── */
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.lp-card');
    const MAX_TILT = 6;

    const handleMove = (card: HTMLElement, e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = Math.max(-MAX_TILT, Math.min(MAX_TILT, -(y - centerY) / 18));
      const rotateY = Math.max(-MAX_TILT, Math.min(MAX_TILT, (x - centerX) / 18));
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-12px) scale(1.03)`;
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
    };

    const handleLeave = (card: HTMLElement) => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg) translateY(0) scale(1)';
    };

    const listeners: Array<{ card: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }> = [];
    cards.forEach(card => {
      const move = (e: MouseEvent) => handleMove(card, e);
      const leave = () => handleLeave(card);
      card.addEventListener('mousemove', move);
      card.addEventListener('mouseleave', leave);
      listeners.push({ card, move, leave });
    });

    return () => {
      listeners.forEach(({ card, move, leave }) => {
        card.removeEventListener('mousemove', move);
        card.removeEventListener('mouseleave', leave);
      });
    };
  }, [isVisible]);

  /* ── Rail auto-drift — slow editorial scroll that yields to the user ── */
  useEffect(() => {
    const el = railMaskRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const DRIFT_PX_PER_SEC = 25;
    const IDLE_MS = 2500;

    let rafId = 0;
    let resumeTimer: number | null = null;
    let isHovered = false;
    let isDrifting = false;
    let prevTs = 0;

    const stopDrift = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      isDrifting = false;
      el.classList.remove('is-drifting');
    };

    const startDrift = () => {
      if (isDrifting || isHovered) return;
      isDrifting = true;
      el.classList.add('is-drifting');
      prevTs = performance.now();
      const tick = (now: number) => {
        const dt = now - prevTs;
        prevTs = now;
        const half = el.scrollWidth / 2;
        if (half > 0) {
          let next = el.scrollLeft + (DRIFT_PX_PER_SEC * dt) / 1000;
          if (next >= half) next -= half;
          el.scrollLeft = next;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    const clearResume = () => {
      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const scheduleResume = () => {
      clearResume();
      resumeTimer = window.setTimeout(() => {
        resumeTimer = null;
        if (!isHovered) startDrift();
      }, IDLE_MS);
    };

    const onEnter = () => {
      isHovered = true;
      clearResume();
      stopDrift();
    };
    const onLeave = () => {
      isHovered = false;
      scheduleResume();
    };
    const onInteract = () => {
      stopDrift();
      scheduleResume();
    };

    // Infinite loop for manual scroll — teleport across the duplicated
    // card set so either edge feels continuous. Skipped during auto-drift
    // because the rAF loop already wraps itself.
    const onScroll = () => {
      if (isDrifting) return;
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      if (el.scrollLeft <= 0) {
        el.scrollLeft += half;
      } else if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
        el.scrollLeft -= half;
      }
    };

    const startTimer = window.setTimeout(() => {
      if (!isHovered) startDrift();
    }, 800);

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('pointerdown', onInteract, { passive: true });
    el.addEventListener('touchstart', onInteract, { passive: true });
    el.addEventListener('wheel', onInteract, { passive: true });
    el.addEventListener('focusin', onInteract);
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.clearTimeout(startTimer);
      clearResume();
      stopDrift();
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('pointerdown', onInteract);
      el.removeEventListener('touchstart', onInteract);
      el.removeEventListener('wheel', onInteract);
      el.removeEventListener('focusin', onInteract);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  /* ── Parallax glow behind cards ── */
  useEffect(() => {
    const section = demoRef.current;
    const glow = glowRef.current;
    if (!section || !glow) return;

    const MAX_MOVE = 15;

    const handleMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const moveX = x * MAX_MOVE * 2;
      const moveY = y * MAX_MOVE * 2;
      glow.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
    };

    const handleLeave = () => {
      glow.style.transform = 'translate(-50%, -50%)';
    };

    section.addEventListener('mousemove', handleMove);
    section.addEventListener('mouseleave', handleLeave);
    return () => {
      section.removeEventListener('mousemove', handleMove);
      section.removeEventListener('mouseleave', handleLeave);
    };
  }, [isVisible]);

  const handleEnter = () => {
    window.location.href = "/create";
  };

  const handleSendLoginLink = () => {
    if (!emailInput || !emailInput.includes('@')) return;
    console.log('Send magic link to:', emailInput);
  };

  return (
    <div className={`landing-v2 ${isVisible ? 'opacity-100' : 'opacity-0'}`} ref={containerRef} style={{ transition: 'opacity 1s ease' }}>

      {/* ── Modals ── */}
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsModal   isOpen={showTerms}   onClose={() => setShowTerms(false)} />
      <HelpModal    isOpen={showHelp}    onClose={() => setShowHelp(false)} />
      <MyLettersModal
        isOpen={showMyLetters}
        onClose={() => setShowMyLetters(false)}
        onCreateNew={handleEnter}
      />

      {/* ══════════════════════════════════════
          NAV
      ══════════════════════════════════════ */}
      <nav className={`lp-nav ${pastHero ? 'lp-nav--past-hero' : ''}`}>
        <div className="lp-nav__left">
          <div className="lp-nav__logo">V</div>
          <span className="lp-nav__brand">Sealed Vow</span>
        </div>
        <div className="lp-nav__right">
          <button className="lp-nav__begin" onClick={handleEnter}>Create</button>
          {user ? (
            <UserMenu
              user={user}
              onOpenLetters={() => setShowMyLetters(true)}
              onSignOut={async () => {
                await signOut();
                window.location.reload();
              }}
            />
          ) : (
            <button className="lp-nav__signin" onClick={() => setShowLogin(true)}>Sign In</button>
          )}
        </div>
      </nav>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="lp-hero" ref={heroRef}>
        <div className="lp-hero__center">
          <div className="lp-v-ring"><span>V</span></div>
          <h1 className="lp-hero__h1">A letter.<br />Not a text.</h1>
          <p className="lp-hero__kicker">Sealed. Private. Opened once.</p>
          <div className="lp-hero__rule" />
          <button className="lp-btn-begin" onClick={handleEnter}>Create</button>
        </div>
        <div className="lp-hero__bottom">
          <div className="lp-scroll-signal">
            <span>Scroll</span>
            <div className="lp-scroll-line" />
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          DEMO CARDS — directly after hero
      ══════════════════════════════════════ */}
      <section className="lp-demo-cards" ref={demoRef}>
        <div className="lp-demo-cards__glow" ref={glowRef} />
        <div className="lp-demo-cards__heading lp-fade">
          <p className="lp-demo-cards__title">Preview the experience</p>
          <p className="lp-demo-cards__sub">See how your letter arrives</p>
        </div>

        <div className="lp-rail lp-fade">
          <div className="lp-rail__mask" ref={railMaskRef}>
            <div className="lp-rail__track">

              {/* ── Card set 1 ── */}
              {/* Anniversary */}
              <a className="lp-card lp-card--anniversary" href="/demo/anniversary">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 18l16 14 16-14"/><rect x="8" y="18" width="32" height="22" rx="2"/>
                    <line x1="8" y1="40" x2="20" y2="30"/><line x1="40" y1="40" x2="28" y2="30"/>
                    <circle cx="24" cy="12" r="4"/><path d="M20 12c0-4 4-8 4-8s4 4 4 8"/>
                  </svg>
                </div>
                <span className="lp-card__title">Anniversary</span>
                <span className="lp-card__desc">Sealed just for you</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* Birthday */}
              <a className="lp-card lp-card--birthday" href="/demo/birthday">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="22" width="32" height="18" rx="3"/><rect x="12" y="16" width="24" height="6" rx="2"/>
                    <line x1="24" y1="16" x2="24" y2="40"/><path d="M24 10c0-3 2-5 0-7"/>
                    <circle cx="24" cy="13" r="1.5" fill="rgba(242,232,213,0.35)" stroke="none"/>
                  </svg>
                </div>
                <span className="lp-card__title">Birthday</span>
                <span className="lp-card__desc">Someone left you this</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* Thank You */}
              <a className="lp-card lp-card--thankyou" href="/demo/thankyou">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 42c-8-6-16-12-16-22a10 10 0 0 1 16-8 10 10 0 0 1 16 8c0 10-8 16-16 22z"/>
                    <path d="M20 22l3 3 6-6"/>
                  </svg>
                </div>
                <span className="lp-card__title">Thank You</span>
                <span className="lp-card__desc">Words they deserve</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* Eid */}
              <a className="lp-card lp-card--eid" href="/demo/eid">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 6c0 8-6 12-6 18a6 6 0 0 0 12 0c0-6-6-10-6-18z"/>
                    <path d="M20 38c-4 2-8 3-8 3"/><path d="M28 38c4 2 8 3 8 3"/>
                    <circle cx="36" cy="10" r="2.5"/>
                    <path d="M36 6v-2M36 16v-2M40 10h2M32 10h-2M39 7l1-1M33 13l-1 1M39 13l1 1M33 7l-1-1"/>
                  </svg>
                </div>
                <span className="lp-card__title">Eid</span>
                <span className="lp-card__desc">Open a sealed eidi</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* Just Because */}
              <a className="lp-card lp-card--justbecause" href="/demo/justbecause">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 8v32"/><path d="M16 16c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
                    <circle cx="24" cy="24" r="14"/>
                    <path d="M14 24h20"/><path d="M18 18l12 12"/><path d="M30 18l-12 12"/>
                  </svg>
                </div>
                <span className="lp-card__title">Just Because</span>
                <span className="lp-card__desc">No reason needed</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* Apology */}
              <a className="lp-card lp-card--apology" href="/demo/apology">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 28c-4 0-8-3-8-8s4-8 8-8c2 0 4 1 5 2"/>
                    <path d="M32 28c4 0 8-3 8-8s-4-8-8-8c-2 0-4 1-5 2"/>
                    <path d="M20 14c2-2 5-2 8 0"/>
                    <path d="M14 30l-2 10 6-4 6 4-2-10"/><path d="M26 30l-2 10 6-4 6 4-2-10"/>
                  </svg>
                </div>
                <span className="lp-card__title">Apology</span>
                <span className="lp-card__desc">Read what they wrote</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* ── Card set 2 (duplicate for seamless loop) ── */}
              <a className="lp-card lp-card--anniversary" href="/demo/anniversary" aria-hidden="true">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 18l16 14 16-14"/><rect x="8" y="18" width="32" height="22" rx="2"/>
                    <line x1="8" y1="40" x2="20" y2="30"/><line x1="40" y1="40" x2="28" y2="30"/>
                    <circle cx="24" cy="12" r="4"/><path d="M20 12c0-4 4-8 4-8s4 4 4 8"/>
                  </svg>
                </div>
                <span className="lp-card__title">Anniversary</span>
                <span className="lp-card__desc">Sealed just for you</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              <a className="lp-card lp-card--birthday" href="/demo/birthday" aria-hidden="true">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="22" width="32" height="18" rx="3"/><rect x="12" y="16" width="24" height="6" rx="2"/>
                    <line x1="24" y1="16" x2="24" y2="40"/><path d="M24 10c0-3 2-5 0-7"/>
                    <circle cx="24" cy="13" r="1.5" fill="rgba(242,232,213,0.35)" stroke="none"/>
                  </svg>
                </div>
                <span className="lp-card__title">Birthday</span>
                <span className="lp-card__desc">Someone left you this</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              <a className="lp-card lp-card--thankyou" href="/demo/thankyou" aria-hidden="true">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 42c-8-6-16-12-16-22a10 10 0 0 1 16-8 10 10 0 0 1 16 8c0 10-8 16-16 22z"/>
                    <path d="M20 22l3 3 6-6"/>
                  </svg>
                </div>
                <span className="lp-card__title">Thank You</span>
                <span className="lp-card__desc">Words they deserve</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              <a className="lp-card lp-card--eid" href="/demo/eid" aria-hidden="true">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 6c0 8-6 12-6 18a6 6 0 0 0 12 0c0-6-6-10-6-18z"/>
                    <path d="M20 38c-4 2-8 3-8 3"/><path d="M28 38c4 2 8 3 8 3"/>
                    <circle cx="36" cy="10" r="2.5"/>
                    <path d="M36 6v-2M36 16v-2M40 10h2M32 10h-2M39 7l1-1M33 13l-1 1M39 13l1 1M33 7l-1-1"/>
                  </svg>
                </div>
                <span className="lp-card__title">Eid</span>
                <span className="lp-card__desc">Open a sealed eidi</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              <a className="lp-card lp-card--justbecause" href="/demo/justbecause" aria-hidden="true">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 8v32"/><path d="M16 16c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
                    <circle cx="24" cy="24" r="14"/>
                    <path d="M14 24h20"/><path d="M18 18l12 12"/><path d="M30 18l-12 12"/>
                  </svg>
                </div>
                <span className="lp-card__title">Just Because</span>
                <span className="lp-card__desc">No reason needed</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              <a className="lp-card lp-card--apology" href="/demo/apology" aria-hidden="true">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="rgba(242,232,213,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 28c-4 0-8-3-8-8s4-8 8-8c2 0 4 1 5 2"/>
                    <path d="M32 28c4 0 8-3 8-8s-4-8-8-8c-2 0-4 1-5 2"/>
                    <path d="M20 14c2-2 5-2 8 0"/>
                    <path d="M14 30l-2 10 6-4 6 4-2-10"/><path d="M26 30l-2 10 6-4 6 4-2-10"/>
                  </svg>
                </div>
                <span className="lp-card__title">Apology</span>
                <span className="lp-card__desc">Read what they wrote</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 2 — PROBLEM
      ══════════════════════════════════════ */}
      <section className="lp-section">
        <p className="lp-section__num lp-fade">02</p>
        <div className="lp-fade">
          <p className="lp-s2__headline">Some things shouldn't<br />disappear in a chat history.</p>
          <p className="lp-s2__sub">Write them properly.</p>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 3 — THE MAGIC
      ══════════════════════════════════════ */}
      <section className="lp-section lp-section--s3">
        <p className="lp-section__num lp-fade">03</p>
        <div className="lp-s3__block lp-fade">
          <span className="lp-s3__connector">A letter written</span>
          <span className="lp-s3__statement">for one person.</span>
          <span className="lp-s3__connector">Sealed until</span>
          <span className="lp-s3__statement">they open it.</span>
          <div className="lp-s3__rule" />
          <span className="lp-s3__connector">Gone from</span>
          <span className="lp-s3__statement">everywhere else.</span>
          <p className="lp-s3__close">Only the person you choose<br />can ever read it.</p>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 4 — PRIVACY
      ══════════════════════════════════════ */}
      <section className="lp-section lp-section--s4">
        <p className="lp-section__num lp-fade">04</p>
        <div className="lp-fade">
          <p className="lp-s4__main">Private by design.</p>
          <div className="lp-s4__list">
            <p className="lp-s4__item">Nothing you write is public.</p>
            <p className="lp-s4__item">Nothing is indexed.</p>
            <p className="lp-s4__item">Nothing can be discovered.</p>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 5 — FINAL CTA
      ══════════════════════════════════════ */}
      <section className="lp-section lp-section--s5">
        <p className="lp-section__num lp-fade">05</p>
        <div className="lp-fade">
          <p className="lp-s5__headline">When the moment deserves<br />more than a message.</p>
          <p className="lp-s5__sub">One letter. One person. Forever sealed.</p>
          <p className="lp-s5__price">One letter · ₹249</p>
        </div>
      </section>


      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer__columns">
          <div className="lp-footer__col">
            <p className="lp-footer__col-heading">SEALED VOW</p>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">How It Works</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div className="lp-footer__col">
            <p className="lp-footer__col-heading">Policy</p>
            <ul>
              <li><button onClick={() => setShowPrivacy(true)}>Privacy Policy</button></li>
              <li><button onClick={() => setShowTerms(true)}>Terms of Use</button></li>
            </ul>
          </div>
          <div className="lp-footer__col">
            <p className="lp-footer__col-heading">Need Help?</p>
            <ul>
              <li><button onClick={() => setShowHelp(true)}>Contact Us</button></li>
              <li><a href="#">FAQs</a></li>
            </ul>
          </div>
          <div className="lp-footer__col">
            <p className="lp-footer__col-heading">Stay in the loop</p>
            <p className="lp-footer__subscribe-text">Thoughtful updates on new features and quiet moments.</p>
            <div className="lp-footer__subscribe-form">
              <input className="lp-footer__subscribe-input" type="email" placeholder="Enter email address" />
              <button className="lp-footer__subscribe-btn">→</button>
            </div>
          </div>
        </div>
        <div className="lp-footer__bottom">
          <div className="lp-footer__socials">
            <a href="#" className="lp-footer__social-link" aria-label="Instagram">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="#" className="lp-footer__social-link" aria-label="X / Twitter">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.634 5.903-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>
            </a>
            <a href="#" className="lp-footer__social-link" aria-label="LinkedIn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          </div>
          <p className="lp-footer__copy">© 2026 SEALED VOW. All rights reserved.</p>
          <p className="lp-footer__tagline">Private by design. Nothing public. Ever.</p>
        </div>
      </footer>


      {/* ══════════════════════════════════════
          LOGIN MODAL
      ══════════════════════════════════════ */}
      <div
        className={`lp-modal-backdrop ${showLogin ? 'open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}
      >
        <div className="lp-modal">
          <button className="lp-modal__close" onClick={() => setShowLogin(false)}>✕</button>
          <h2 className="lp-modal__title">Sign in</h2>
          <p className="lp-modal__sub">Save your letters<br />and view them later.</p>
          <div className="lp-modal__rule" />
          <button
            className="lp-btn-google"
            disabled={isSigningIn}
            onClick={async () => {
              setSignInError(null);
              setIsSigningIn(true);
              try {
                await signInWithGoogle();
                setShowLogin(false);
                onEnter();
              } catch (err) {
                const code = (err as { code?: string })?.code || '';
                if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
                  // User-initiated cancel — don't show an error.
                } else if (code === 'auth/popup-blocked') {
                  setSignInError('Popup was blocked. Please allow popups and try again.');
                } else {
                  setSignInError('Sign-in failed. Please try again.');
                }
                console.error('Google sign-in failed:', err);
              } finally {
                setIsSigningIn(false);
              }
            }}
          >
            {isSigningIn ? 'Signing in…' : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
          {signInError && (
            <p role="alert" style={{ color: '#e88', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              {signInError}
            </p>
          )}
          <button className="lp-btn-guest" onClick={() => { setShowLogin(false); onEnter(); }}>Continue as Guest</button>
          <div className="lp-modal__or"><span>or</span></div>
          <input className="lp-modal__input" type="email" placeholder="your@email.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendLoginLink()} />
          <button className="lp-btn-email-send" onClick={handleSendLoginLink}>Send login link</button>
          <p className="lp-modal__guest-note">Guest letters are not saved after the session ends.</p>
        </div>
      </div>

    </div>
  );
};