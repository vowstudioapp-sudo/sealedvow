import React from 'react';

const LandingScrollSections: React.FC = () => {
  return (
    <>
      {/* ══════════════════════════════════════
          SECTION 2 — PROBLEM
      ══════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-fade">
          <p className="lp-s2__headline">Some things shouldn't<br />disappear in a chat history.</p>
          <p className="lp-s2__sub">Write them properly.</p>
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
        </div>
      </section>
    </>
  );
};

export default LandingScrollSections;
