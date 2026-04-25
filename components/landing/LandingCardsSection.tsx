import React from 'react';

type Props = {
  sectionRef?: React.RefObject<HTMLElement | null>;
};

const LandingCardsSection: React.FC<Props> = ({ sectionRef }) => {
  return (
    <section className="lp-demo-cards" ref={sectionRef}>
      <div className="lp-demo-cards__heading">
        <p className="lp-demo-cards__title">Preview the experience</p>
        <p className="lp-demo-cards__sub">See how your letter arrives</p>
      </div>

      <div className="lp-rail lp-fade">
        <div className="lp-rail__mask">
          <div className="lp-rail__track">
            {/* Anniversary */}
            <a className="lp-card lp-card--anniversary" style={{ ['--card-accent' as any]: '#C95A4A' }} href="/demo/anniversary">
              <div className="lp-card__icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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
            <a className="lp-card lp-card--birthday" style={{ ['--card-accent' as any]: '#E6B450' }} href="/demo/birthday">
              <div className="lp-card__icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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
            <a className="lp-card lp-card--thankyou" style={{ ['--card-accent' as any]: '#D89BA8' }} href="/demo/thankyou">
              <div className="lp-card__icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M24 42c-8-6-16-12-16-22a10 10 0 0 1 16-8 10 10 0 0 1 16 8c0 10-8 16-16 22z"/>
                  <path d="M20 22l3 3 6-6"/>
                </svg>
              </div>
              <span className="lp-card__title">Thank You</span>
              <span className="lp-card__desc">Words they deserve</span>
              <span className="lp-card__hint">Preview →</span>
            </a>

            {/* Eid */}
            <a className="lp-card lp-card--eid" style={{ ['--card-accent' as any]: '#4CAF78' }} href="/demo/eid">
              <div className="lp-card__icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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
            <a className="lp-card lp-card--justbecause" style={{ ['--card-accent' as any]: '#7A6AE6' }} href="/demo/justbecause">
              <div className="lp-card__icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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
            <a className="lp-card lp-card--apology" style={{ ['--card-accent' as any]: '#E8E4EC' }} href="/demo/apology">
              <div className="lp-card__icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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
  );
};

export default LandingCardsSection;
