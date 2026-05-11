import React, { useEffect, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';
import { HelpModal } from './HelpModal';

const PAGE_TITLE = 'How It Works — Sealed Vow';
const PAGE_DESCRIPTION = 'A quiet explanation of how Sealed Vow works.';

const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const HowItWorksPage: React.FC = () => {
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
          <p className="lp-about__eyebrow" style={{ marginBottom: 14 }}>How It Works</p>
          <h1 className="lp-about__title" style={{ marginBottom: 28 }}>How Sealed Vow works.</h1>

          <section className="lp-about__section lp-about__section--intro">
            <p className="lp-about__p">Sealed Vow lets you create a private letter experience for one specific person.</p>
            <p className="lp-about__p">You can write an anniversary letter, or the kind of words you may have been carrying for a long time but never properly said.</p>
            <p className="lp-about__p">You add your words, memories, photographs, promises, music, meaningful places, and small details that matter to both of you.</p>
            <p className="lp-about__p">Everything is then sealed into a private link only they can open.</p>
          </section>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <h2 className="lp-about__h2">What you do.</h2>
            <p className="lp-about__p">You write the letter in your own words.</p>
            <p className="lp-about__p">If you need help shaping what you want to say, assisted writing support can help generate wording more clearly — but everything can still be rewritten, edited, or removed afterward.</p>
            <p className="lp-about__p">Some letters take ten minutes.</p>
            <p className="lp-about__p">Others take an hour.</p>
            <p className="lp-about__p">Sealed Vow is designed to be built slowly.</p>
            <p className="lp-about__p">Your work is saved as you write. You can leave, return later, and continue from where you stopped.</p>
            <p className="lp-about__p">The things people carry for a long time are rarely written all at once.</p>
          </section>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <h2 className="lp-about__h2">What happens after.</h2>
            <p className="lp-about__p">When the experience is finished, it becomes a private link meant for one specific person.</p>
            <p className="lp-about__p">You share that link however you normally reach them.</p>
            <p className="lp-about__p">When they open it, the experience unfolds gradually instead of appearing all at once.</p>
            <p className="lp-about__p">You will know when they open it.</p>
          </section>

          <hr className="lp-about__sep" aria-hidden="true" />

          <section className="lp-about__section">
            <p className="lp-about__p">Sealed Vow is not built for posting publicly or collecting attention.</p>
            <p className="lp-about__p">It is simply a quieter way to make someone feel remembered properly.</p>
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
    </div>
  );
};

export default HowItWorksPage;
