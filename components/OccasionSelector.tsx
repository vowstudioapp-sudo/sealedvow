import React from "react";
import { motion } from "framer-motion";
import "../styles/occasion-selector.css";
import { markIntentionalEntry } from "../utils/intentionalEntry";

export const OccasionSelector: React.FC = () => {

  const go = (path: string) => {
    // PR #11 — picking an occasion is a fresh-letter intent. Mark before
    // SPA navigation so PreparationForm sees the flag on its next mount
    // and shows the resume modal if a meaningful draft exists. Only
    // fires for /letter/create paths; "/" (back) doesn't need it.
    if (path.startsWith("/letter/create")) {
      markIntentionalEntry();
    }
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
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
        
        {/* Anniversary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
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

        {/* Unsaid (internal id remains 'just-because' — UI rename only) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
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
            <span className="occasion-card__title">Unsaid</span>
            <span className="occasion-card__subtitle">For the words that have been waiting</span>
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