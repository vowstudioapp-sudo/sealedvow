
import React, { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden'; // Prevent scrolling bg
    } else {
      setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen && !isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center px-4 transition-all duration-500 ${isOpen ? 'opacity-100 backdrop-blur-sm bg-black/60' : 'opacity-0 backdrop-blur-none bg-transparent pointer-events-none'}`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl bg-[#0F0F0F] border border-[#D4AF37]/30 shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden transition-all duration-700 transform ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}`}
      >
        {/* Header */}
        <div className="relative p-8 border-b border-[#D4AF37]/10 bg-[#141414]">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent"></div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                   </div>
                   <div>
                       <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-bold">VOW Protocol</h2>
                       <h1 className="text-xl font-serif-elegant italic text-white">Privacy & Sovereignty</h1>
                   </div>
                </div>
                <button onClick={onClose} className="text-[#666] hover:text-white transition-colors p-2">
                   ✕
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-10">
            
            {/* Section 1: The Core Promise */}
            <section>
                <h3 className="text-[#D4AF37] text-[9px] uppercase tracking-[0.2em] font-bold mb-3 flex items-center gap-2">
                   <span className="w-1 h-1 bg-[#D4AF37] rounded-full"></span>
                   The Custody Promise
                </h3>
                <p className="text-[#CCC] text-sm leading-relaxed font-serif-elegant italic opacity-80 border-l-2 border-[#D4AF37]/20 pl-4 mb-6">
                   "We act as a courier, not a reader. Your message is sealed, delivered, and exists only for the intended recipient. We do not open the envelope. Privacy is not a feature here — it is the foundation."
                </p>
                
                {/* Explicit Human Reassurance */}
                <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded text-center">
                    <p className="text-[#E5D0A1] text-xs font-serif-elegant italic">
                        "Your message is never reviewed by a human. It is delivered automatically and privately."
                    </p>
                </div>
            </section>

            {/* Section 2: What Information We Handle (New) */}
            <section>
                <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-3">What Information We Handle</h3>
                <p className="text-[#888] text-xs leading-relaxed mb-4">
                   We only handle what is necessary to deliver your experience: names of sender and recipient, your written content, optional media, and delivery preferences.
                </p>
                <ul className="space-y-2 text-[#AAA] text-xs">
                    <li className="flex gap-3">
                         <span className="text-[#D4AF37] mt-0.5">✦</span>
                         <span>We <strong className="text-white">do not</strong> collect information for advertising, profiling, or resale.</span>
                    </li>
                </ul>
            </section>

            {/* Section 3: Technical Security (Existing) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#1A1A1A] p-5 rounded border border-white/5">
                   <div className="text-green-400 text-xs mb-2 font-mono">ENCRYPTION: AT_REST</div>
                   <h4 className="text-white text-sm font-bold mb-2">AES-256 Storage</h4>
                   <p className="text-[#888] text-[10px] leading-relaxed">
                      Your letters and media are encrypted on our servers using Advanced Encryption Standard (256-bit). Even if physical drives are accessed, the data remains unreadable.
                   </p>
                </div>
                <div className="bg-[#1A1A1A] p-5 rounded border border-white/5">
                   <div className="text-green-400 text-xs mb-2 font-mono">ENCRYPTION: IN_TRANSIT</div>
                   <h4 className="text-white text-sm font-bold mb-2">TLS 1.3 Transport</h4>
                   <p className="text-[#888] text-[10px] leading-relaxed">
                      From your device to our sanctuary, every byte is tunneled through Transport Layer Security 1.3, preventing any interception during delivery.
                   </p>
                </div>
            </section>

            {/* Section 4: Writing Assistance (Existing + Refined) */}
            <section>
                <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-3">How Writing Assistance Works</h3>
                
                <p className="text-[#AAA] text-xs leading-relaxed mb-6 font-serif-elegant italic">
                   VOW uses technology only to help you express what you already feel — then steps out of the way.
                </p>

                <ul className="space-y-4 text-[#AAA] text-xs">
                    <li className="flex gap-3">
                         <span className="text-[#D4AF37] mt-0.5">✦</span>
                         <span>Your input is processed briefly to help shape the letter. Once the letter is created, that writing context is discarded. AI is used as a temporary tool, not a listener or archive.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>We <strong className="text-white">do not</strong> read your messages, nor do we store them for training public AI models.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>We <strong className="text-white">do not</strong> sell your emotional data to advertisers.</span>
                    </li>
                </ul>
            </section>

            {/* Section 5: What We Do Not Do (Expanded) */}
            <section>
                <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-3">What We Do Not Do</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[#AAA] text-xs">
                    <div className="flex gap-3">
                        <span className="text-red-400">✕</span>
                        <span>Display messages publicly or create social feeds.</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="text-red-400">✕</span>
                        <span>Track how long a recipient reads your letter.</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="text-red-400">✕</span>
                        <span>Store payment card or banking details on our servers. (Processed via secure partners).</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="text-red-400">✕</span>
                        <span>Collect data from individuals under 18.</span>
                    </div>
                </div>
            </section>

            {/* Section 6: Storage, Retention & Rights (Merged) */}
            <section className="pt-6 border-t border-white/5">
                <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-3">Storage, Retention & Rights</h3>
                <p className="text-[#888] text-xs leading-relaxed mb-4">
                   Messages are stored only as long as needed to deliver the experience. Minimal technical logs are retained briefly for security.
                </p>
                <p className="text-[#888] text-xs leading-relaxed mb-6">
                   <strong className="text-[#D4AF37]">Your Rights (India):</strong> In accordance with Indian data protection laws, you have the right to access your data, request correction or deletion, withdraw consent, and request information about how your data is handled.
                </p>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <p className="text-[9px] uppercase tracking-widest text-[#666] mb-1">Privacy Officer</p>
                        <a href="mailto:privacy@vow.studio" className="text-[10px] text-[#D4AF37] hover:text-white transition-colors border-b border-[#D4AF37]/30 pb-0.5">
                           privacy@vow.studio
                        </a>
                    </div>
                    <button className="text-[9px] uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors border-b border-red-900/50 pb-0.5">
                       Request Immediate Deletion
                    </button>
                </div>
            </section>

        </div>

        {/* Footer */}
        <div className="p-6 bg-[#0A0A0A] border-t border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[8px] uppercase tracking-widest text-[#666]">System Secure</span>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-[#D4AF37] text-black text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-colors rounded-sm"
            >
               Acknowledge
            </button>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1a1a1a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D4AF37; }
      `}</style>
    </div>
  );
};
