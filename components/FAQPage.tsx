import React, { useEffect, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';
import { HelpModal } from './HelpModal';

const PAGE_TITLE = 'FAQ — Sealed Vow';
const PAGE_DESCRIPTION = 'A few quiet answers about Sealed Vow — what it is, how it works, and why it stays private.';

const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

type FaqEntry = { q: string; a: string };

const FAQS: FaqEntry[] = [
  {
    q: 'What is Sealed Vow?',
    a: 'A private space for writing letters that are meant to be felt, not rushed.',
  },
  {
    q: 'Who can read the letters?',
    a: 'Only the person you choose. Your letters are never public.',
  },
  {
    q: 'Is Sealed Vow a messaging app?',
    a: 'No. It’s built for slower, more intentional communication — the kind people usually leave unsaid.',
  },
  {
    q: 'Do both people need an account?',
    a: 'Yes. Both people need a Sealed Vow account to send and receive letters securely.',
  },
  {
    q: 'Can I send photos with a letter?',
    a: 'Yes. Some memories are easier to feel when they’re seen.',
  },
  {
    q: 'Can I edit a letter before it’s opened?',
    a: 'Yes. Until it’s opened, you can still make changes to what you wrote.',
  },
  {
    q: 'Why are letters locked until opened?',
    a: 'Because anticipation is part of the experience. Some words deserve a moment of their own.',
  },
  {
    q: 'Is Sealed Vow private?',
    a: 'Yes. Your letters stay between you and the person they’re meant for.',
  },
  {
    q: 'Why does Sealed Vow feel different from regular messaging apps?',
    a: 'Because it’s built for slower, more intentional moments — not constant conversation.',
  },
  {
    q: 'Why write letters digitally instead of texting?',
    a: 'Because some feelings deserve more care than a disappearing message bubble.',
  },
];

export const FAQPage: React.FC = () => {
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
          ARTICLE — editorial Q&A (no accordions)
      ══════════════════════════════════════ */}
      <main className="lp-about__main">
        <article className="lp-about__article">
          <p className="lp-about__eyebrow" style={{ marginBottom: 14 }}>Questions people ask</p>
          <h1 className="lp-about__title" style={{ marginBottom: 24 }}>A few things worth knowing.</h1>

          <p className="lp-faq-intro">
            Sealed Vow is intentionally slower and quieter than most apps. These answers explain the experience, the privacy, and the thinking behind it.
          </p>

          <div className="lp-faq-list">
            {FAQS.map((entry, i) => (
              <section className="lp-faq-item" key={i}>
                <h2 className="lp-faq-item__q">{entry.q}</h2>
                <p className="lp-faq-item__a">{entry.a}</p>
              </section>
            ))}
          </div>
        </article>
      </main>

      {/* ══════════════════════════════════════
          FOOTER — same as LP (PR-40 layout)
      ══════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer__columns">
          <div className="lp-footer__col">
            <p className="lp-footer__col-heading">SEALED VOW</p>
            <ul>
              <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('/about'); }}>About Us</a></li>
              <li><a href="/how-it-works" onClick={(e) => { e.preventDefault(); navigateTo('/how-it-works'); }}>How It Works</a></li>
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
              <li><a href="/faq" onClick={(e) => { e.preventDefault(); navigateTo('/faq'); }}>FAQs</a></li>
            </ul>
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

export default FAQPage;
