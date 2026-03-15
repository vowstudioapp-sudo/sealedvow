import React from "react";
import { motion } from "framer-motion";
import "../styles/occasion-selector.css";

export const OccasionSelector: React.FC = () => {

  const go = (path: string) => {
    window.location.href = path;
  };

  return (
    <div className="occasion-selector">
      
      {/* Background */}
      <div className="occasion-selector__bg" />

      {/* Header */}
      <motion.div
        className="occasion-selector__header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <p className="occasion-selector__eyebrow">CREATE A SEALED MOMENT</p>
        <h1 className="occasion-selector__title">Choose the Occasion</h1>
      </motion.div>

      {/* Eid Hero Card */}
      <motion.div
        className="occasion-selector__hero"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="occasion-card occasion-card--eid occasion-card--hero" onClick={() => go("/demo/eid")}>
          <div className="occasion-card__glow" />
          <div className="occasion-card__icon">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 6c0 8-6 12-6 18a6 6 0 0 0 12 0c0-6-6-10-6-18z"/>
              <path d="M20 38c-4 2-8 3-8 3"/><path d="M28 38c4 2 8 3 8 3"/>
              <circle cx="36" cy="10" r="2.5"/>
              <path d="M36 6v-2M36 16v-2M40 10h2M32 10h-2M39 7l1-1M33 13l-1 1M39 13l1 1M33 7l-1-1"/>
            </svg>
          </div>
          <span className="occasion-card__title">Eid</span>
          <span className="occasion-card__subtitle">Share Eid Blessings</span>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="occasion-selector__divider">
        <span>MOMENTS</span>
      </div>

      {/* Moments Grid */}
      <motion.div
        className="occasion-selector__grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        
        {/* Birthday */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="occasion-card occasion-card--birthday" onClick={() => go("/letter/create?occasion=birthday")}>
            <div className="occasion-card__glow" />
            <div className="occasion-card__icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="22" width="32" height="18" rx="3"/>
                <rect x="12" y="16" width="24" height="6" rx="2"/>
                <line x1="24" y1="16" x2="24" y2="40"/>
                <path d="M24 10c0-3 2-5 0-7"/>
                <circle cx="24" cy="13" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <span className="occasion-card__title">Birthday</span>
            <span className="occasion-card__subtitle">Celebrate them</span>
          </div>
        </motion.div>

        {/* Anniversary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="occasion-card occasion-card--anniversary" onClick={() => go("/letter/create?occasion=anniversary")}>
            <div className="occasion-card__glow" />
            <div className="occasion-card__icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 18l16 14 16-14"/><rect x="8" y="18" width="32" height="22" rx="2"/>
                <line x1="8" y1="40" x2="20" y2="30"/><line x1="40" y1="40" x2="28" y2="30"/>
                <circle cx="24" cy="12" r="4"/><path d="M20 12c0-4 4-8 4-8s4 4 4 8"/>
              </svg>
            </div>
            <span className="occasion-card__title">Anniversary</span>
            <span className="occasion-card__subtitle">Celebrate journey</span>
          </div>
        </motion.div>

        {/* Just Because */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <div className="occasion-card occasion-card--justbecause" onClick={() => go("/letter/create?occasion=just-because")}>
            <div className="occasion-card__glow" />
            <div className="occasion-card__icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M24 8v32"/><path d="M16 16c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
                <circle cx="24" cy="24" r="14"/>
                <path d="M14 24h20"/><path d="M18 18l12 12"/><path d="M30 18l-12 12"/>
              </svg>
            </div>
            <span className="occasion-card__title">Just Because</span>
            <span className="occasion-card__subtitle">No reason needed</span>
          </div>
        </motion.div>

        {/* Apology */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="occasion-card occasion-card--apology" onClick={() => go("/letter/create?occasion=apology")}>
            <div className="occasion-card__glow" />
            <div className="occasion-card__icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 28c-4 0-8-3-8-8s4-8 8-8c2 0 4 1 5 2"/>
                <path d="M32 28c4 0 8-3 8-8s-4-8-8-8c-2 0-4 1-5 2"/>
                <path d="M20 14c2-2 5-2 8 0"/>
                <path d="M24 24v8"/><circle cx="24" cy="37" r="2.5"/>
              </svg>
            </div>
            <span className="occasion-card__title">I'm Sorry</span>
            <span className="occasion-card__subtitle">Make things right</span>
          </div>
        </motion.div>

        {/* Missing You */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <div className="occasion-card occasion-card--longdistance" onClick={() => go("/letter/create?occasion=long-distance")}>
            <div className="occasion-card__glow" />
            <div className="occasion-card__icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 24l12-8v6h12v-6l12 8-12 8v-6H18v6z"/>
                <circle cx="24" cy="24" r="3"/>
              </svg>
            </div>
            <span className="occasion-card__title">Missing You</span>
            <span className="occasion-card__subtitle">Across distance</span>
          </div>
        </motion.div>

        {/* Thank You */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <div className="occasion-card occasion-card--thankyou" onClick={() => go("/letter/create?occasion=thank-you")}>
            <div className="occasion-card__glow" />
            <div className="occasion-card__icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M24 42c-8-6-16-12-16-22a10 10 0 0 1 16-8 10 10 0 0 1 16 8c0 10-8 16-16 22z"/>
                <path d="M20 22l3 3 6-6"/>
              </svg>
            </div>
            <span className="occasion-card__title">Thank You</span>
            <span className="occasion-card__subtitle">Say it properly</span>
          </div>
        </motion.div>

      </motion.div>

      {/* Back Button */}
      <button className="occasion-selector__back" onClick={() => go("/")}>
        ← Back
      </button>

    </div>
  );
};