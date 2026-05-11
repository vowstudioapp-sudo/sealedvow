import React, { useEffect, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';
import { HelpModal } from './HelpModal';

const PAGE_TITLE = 'About — Sealed Vow';
const PAGE_DESCRIPTION = "A short note on what Sealed Vow is, and what it isn't.";

const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const AboutPage: React.FC = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;

    let metaTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const createdMetaTag = !metaTag;
    const previousDescription = metaTag ? metaTag.getAttribute('content') : null;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'description');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', PAGE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      if (createdMetaTag) {
        metaTag?.remove();
      } else if (metaTag) {
        if (previousDescription === null) metaTag.removeAttribute('content');
        else metaTag.setAttribute('content', previousDescription);
      }
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setIsVisible(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const handleHomeNav = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigateTo('/');
  };

  return (
    <div className={`lp-about ${isVisible ? 'lp-about--visible' : ''}`}>
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsModal   isOpen={showTerms}   onClose={() => setShowTerms(false)} />
      <HelpModal    isOpen={showHelp}    onClose={() => setShowHelp(false)} />

      {/* ══════════════════════════════════════
          NAV — wordmark only (return to home)
      ══════════════════════════════════════ */}
      <nav className="lp-nav lp-about__nav">
        <a
          href="/"
          className="lp-nav__left lp-nav__wordmark"
          onClick={handleHomeNav}
          aria-label="Sealed Vow — home"
        >
          <span className="lp-nav__wordmark-sealed">
            <span className="lp-nav__wordmark-sealed-first">S</span>
            <span className="lp-nav__wordmark-sealed-rest">ealed</span>
          </span>
          <span className="lp-nav__wordmark-vow">Vow</span>
        </a>
      </nav>

      {/* ══════════════════════════════════════
          ARTICLE
      ══════════════════════════════════════ */}
      <main className="lp-about__main">
        <article className="lp-about__article">
          <h1 className="lp-about__title">About Sealed Vow</h1>
          <p className="lp-about__eyebrow">A short note on what this is, and what it isn’t.</p>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <p className="lp-about__p">Sealed Vow is a place to write a letter to one specific person, seal it carefully, and share it through a link only they can open.</p>
            <p className="lp-about__p">That is all it does.</p>
            <p className="lp-about__p">There is no feed. No followers. No streaks. No public profiles. No notifications urging you to send more. No way for anyone besides the person you choose to ever see what you wrote.</p>
            <p className="lp-about__p">If you’ve spent the last decade in apps built around engagement metrics, Sealed Vow will feel quiet by comparison. The quietness is the design.</p>
          </section>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <h2 className="lp-about__h2">What it’s for</h2>
            <p className="lp-about__p">The kind of message you’d handwrite if anyone still handwrote letters.</p>
            <p className="lp-about__p">An anniversary that deserves more than a forwarded card. The words you’ve been carrying but couldn’t say. The letter to the version of someone you’ve loved for ten years. The thing you’ve been wanting to write for months but couldn’t fit anywhere a chat app would put it.</p>
            <p className="lp-about__p">The product is restrained, on purpose. It does one thing — make a beautiful, private, deliberate letter — and refuses to do anything else.</p>
          </section>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <h2 className="lp-about__h2">Who built it</h2>
            <p className="lp-about__p">Ajmal Fahad.</p>
            <p className="lp-about__p">Sealed Vow began as one letter — an anniversary letter, written for one specific person, that didn’t fit comfortably into any existing messaging app. The product grew around the thing that letter needed to become.</p>
            <p className="lp-about__p">It is built slowly, on purpose. Restraint is the editorial approach we hold ourselves to.</p>
          </section>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <h2 className="lp-about__h2">Getting in touch</h2>
            <p className="lp-about__p">If something here moves you, the best response is to write the letter you’ve been holding.</p>
            <p className="lp-about__p">If something doesn’t work, write to us anyway — every message is read.</p>
          </section>
        </article>
      </main>

      {/* ══════════════════════════════════════
          FOOTER — same as LP
      ══════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer__columns">
          <div className="lp-footer__col">
            <p className="lp-footer__col-heading">SEALED VOW</p>
            <ul>
              <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('/about'); }}>About Us</a></li>
              <li><a href="/how-it-works" onClick={(e) => { e.preventDefault(); navigateTo('/how-it-works'); }}>How It Works</a></li>
              {/* PR-40: duplicate "Contact" removed — Contact Us
                  already lives under the Need Help? column. */}
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
          {/* PR-40: "Stay in the loop" newsletter column removed —
              the footer ends quietly, not with email capture. */}
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
    </div>
  );
};

export default AboutPage;
