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
            <li><a href="#">About Us</a></li>
            <li><a href="#">How It Works</a></li>
            <li><a href="#">Contact</a></li>
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
  );
};

export default LandingFooter;
