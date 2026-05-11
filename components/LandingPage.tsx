import React, { useEffect, useRef, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';
import { HelpModal } from './HelpModal';
import { MyLettersModal } from './MyLettersModal';
import { UserMenu } from './UserMenu';
import { AtmosphericShell } from './AtmosphericShell';
import { useAuth } from '../hooks/useAuth';
import { markIntentionalEntry } from '../utils/intentionalEntry';

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

  const handleEnter = () => {
    // PR #11 — flags this navigation as a fresh-letter intent so
    // PreparationForm shows the resume modal (if a meaningful saved
    // draft exists) instead of silently restoring it.
    markIntentionalEntry();
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
          HERO
      ══════════════════════════════════════ */}
      {/* ══════════════════════════════════════
          NAV
      ══════════════════════════════════════ */}
      <nav className={`lp-nav ${pastHero ? 'lp-nav--past-hero' : ''}`}>
        <a href="/" className="lp-nav__left lp-nav__wordmark" aria-label="Sealed Vow — home">
          <span className="lp-nav__wordmark-sealed">
            <span className="lp-nav__wordmark-sealed-first">S</span>
            <span className="lp-nav__wordmark-sealed-rest">ealed</span>
          </span>
          <span className="lp-nav__wordmark-vow">Vow</span>
        </a>
        <div className="lp-nav__right">
          <button className="lp-nav__begin" onClick={handleEnter}>Seal your letter</button>
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
            <button className="lp-nav__signin" onClick={() => setShowLogin(true)}>Sign in</button>
          )}
        </div>
      </nav>

      <AtmosphericShell>
        <section className="lp-hero" ref={heroRef}>
          <div className="lp-hero__center">
            <h1 className="lp-hero__h1">A letter.<br />Not a text.</h1>
            <p className="lp-hero__clarity">Some things shouldn't disappear in a chat history.</p>
            <button className="lp-btn-begin" onClick={handleEnter}>CREATE YOUR LETTER</button>
          </div>
          <div className="lp-hero__bottom">
            <div className="lp-scroll-signal">
              <span>Scroll</span>
              <div className="lp-scroll-line" />
            </div>
          </div>
        </section>
      </AtmosphericShell>


      {/* ══════════════════════════════════════
          DEMO CARDS — directly after hero
      ══════════════════════════════════════ */}
      <section className="lp-demo-cards" ref={demoRef}>
        <div className="lp-demo-cards__heading">
          <p className="lp-demo-cards__kicker">Preview the experience</p>
          <p className="lp-demo-cards__title">For the moments between you.</p>
          <p className="lp-demo-cards__sub">Choose one to see how it arrives.</p>
        </div>

        <div className="lp-rail lp-fade">
          <div className="lp-rail__mask">
            <div className="lp-rail__track">

              {/* Anniversary */}
              <a className="lp-card lp-card--anniversary" style={{ ['--card-accent' as any]: '#C95A4A' }} href="/demo/anniversary">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="19" cy="24" r="8"/>
                    <circle cx="29" cy="24" r="8"/>
                    <path d="M23 24h2"/>
                  </svg>
                </div>
                <span className="lp-card__title">Anniversary</span>
                <span className="lp-card__desc">A moment kept, not sent.</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

              {/* Unsaid (internal demo slug remains 'justbecause') */}
              <a className="lp-card lp-card--justbecause" style={{ ['--card-accent' as any]: '#7A6AE6' }} href="/demo/justbecause">
                <div className="lp-card__icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M24 8v32"/><path d="M16 16c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
                    <circle cx="24" cy="24" r="14"/>
                    <path d="M14 24h20"/><path d="M18 18l12 12"/><path d="M30 18l-12 12"/>
                  </svg>
                </div>
                <span className="lp-card__title">Unsaid</span>
                <span className="lp-card__desc">Some things have been waiting to be said.</span>
                <span className="lp-card__hint">Preview →</span>
              </a>

            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 3 — THE MAGIC
      ══════════════════════════════════════ */}
      <section className="lp-section lp-section--s3">
        <div className="lp-s3__block lp-fade">
          <span className="lp-s3__connector">A letter written</span>
          <span className="lp-s3__statement">for one person.</span>
          <span className="lp-s3__connector">Sealed until</span>
          <span className="lp-s3__statement">they open it.</span>
          <div className="lp-s3__rule" />
          <p className="lp-s3__close">Only the person you choose<br />can ever read it.</p>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 2 — PROBLEM
      ══════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-fade">
          <p className="lp-s2__headline">Write them properly.</p>
        </div>
      </section>


      {/* ══════════════════════════════════════
          SECTION 4 — PRIVACY
      ══════════════════════════════════════ */}
      <section className="lp-section lp-section--s4">
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
        <div className="lp-fade">
          <p className="lp-s5__headline">When the moment deserves<br />more than a message.</p>
          <p className="lp-s5__sub">ONE LETTER • ONE PERSON</p>
          <p className="lp-s5__price-anchor">₹249 per letter</p>
          <p className="lp-s5__freemium">Write for free. Send it when it matters.</p>
          <button className="lp-btn-begin" onClick={handleEnter}>CREATE YOUR LETTER</button>
        </div>
      </section>


      {/* ══════════════════════════════════════
          FOUNDER NOTE
      ══════════════════════════════════════ */}
      <section className="lp-section lp-section--founder">
        <div className="lp-fade lp-founder">

          {/* Left: image (45%) */}
          <div className="lp-founder__media">
            <img
              className="lp-founder__image"
              src="/lp/founder-note.webp"
              alt="A handwritten letter beside a wax-sealed envelope"
            />
          </div>

          {/* Right: text (55%) */}
          <div className="lp-founder__text">
            <p className="lp-founder__eyebrow">
              <span className="lp-founder__eyebrow-dash" aria-hidden="true"></span>
              A note from the founder
            </p>

            <h2 className="lp-founder__headline">Why I built this.</h2>

            <div className="lp-founder__body-stack">
              <p className="lp-founder__body lp-founder__body--first">
                I built this because a chat message can't carry weight. The things that matter — the years you want remembered properly, the words you've been carrying but couldn't say, the letter meant for one person and nobody else — these don't belong in a thread that scrolls.
              </p>
              <p className="lp-founder__body">
                They belong somewhere quiet. Sealed. Held until the right moment.
              </p>
              <p className="lp-founder__body">
                Most of what we say now disappears the moment it's read. Sealed Vow exists for the things that shouldn't.
              </p>
            </div>

            <div className="lp-founder__attribution">
              <span className="lp-founder__rule" aria-hidden="true"></span>
              <div className="lp-founder__attribution-text">
                <span className="lp-founder__name">Ajmal Fahad</span>
                <span className="lp-founder__role">Founder, Sealed Vow</span>
              </div>
            </div>

          </div>
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
              <li>
                <a
                  href="/about"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/about');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/how-it-works');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                >
                  How It Works
                </a>
              </li>
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