import React from 'react';

type Props = {
  onShowPrivacy: () => void;
  onShowTerms: () => void;
  onShowHelp: () => void;
};

const LandingFooter: React.FC<Props> = ({ onShowPrivacy, onShowTerms, onShowHelp }) => {
  return (
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
            {/* PR-40: duplicate "Contact" removed — Contact Us
                already lives under the Need Help? column. */}
          </ul>
        </div>
        <div className="lp-footer__col">
          <p className="lp-footer__col-heading">Policy</p>
          <ul>
            <li><button onClick={onShowPrivacy}>Privacy Policy</button></li>
            <li><button onClick={onShowTerms}>Terms of Use</button></li>
          </ul>
        </div>
        <div className="lp-footer__col">
          <p className="lp-footer__col-heading">Need Help?</p>
          <ul>
            <li><button onClick={onShowHelp}>Contact Us</button></li>
            <li>
              <a
                href="/faq"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/faq');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                FAQs
              </a>
            </li>
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
  );
};

export default LandingFooter;
