
import React, { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
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
                      <span className="font-serif-elegant italic font-bold">§</span>
                   </div>
                   <div>
                       <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-bold">Studio Protocol</h2>
                       <h1 className="text-xl font-serif-elegant italic text-white">Terms of Engagement</h1>
                   </div>
                </div>
                <button onClick={onClose} className="text-[#666] hover:text-white transition-colors p-2">
                   ✕
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
            
            <p className="text-[#888] text-xs italic mb-10 border-l border-[#D4AF37]/30 pl-4">
              "By entering the VOW Private Expression Studio, you agree to the following terms. These terms exist to protect your privacy, the integrity of the experience, and the lawful operation of the studio."
            </p>

            <div className="space-y-8">
                {/* Point 1 */}
                <div className="group">
                    <h3 className="text-[#D4AF37] text-[9px] uppercase tracking-[0.2em] font-bold mb-2">01. Acceptance of These Terms</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        By accessing or using VOW (“the Service”), you agree to these Terms. If you do not agree, please do not use the Service.
                    </p>
                </div>

                {/* Point 2 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">02. What VOW Is (and Is Not)</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        VOW is a private expression studio, a courier of private messages, and a sealed delivery experience. <br/>
                        VOW is <strong className="text-white">not</strong> a social network, a messaging app, a publishing platform, or a public archive.
                    </p>
                </div>

                {/* Point 3 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">03. Your Content & Ownership</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed mb-2">
                        You own everything you create on VOW. Your words, images, audio, and memories belong to you. We claim no ownership.
                    </p>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        You grant VOW a temporary, limited license to store, encrypt, and deliver your content only for the purpose of providing the Service. Once delivery is complete (or deletion is requested), that license ends.
                    </p>
                </div>

                {/* Point 4 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">04. Responsibility for Content</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        You are responsible for what you choose to create and send. You agree not to use VOW to harass, threaten, share illegal content, violate privacy, or impersonate others. VOW does not review content proactively but may act if legally required.
                    </p>
                </div>

                {/* Point 5 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">05. AI-Assisted Writing</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        If you use writing assistance, AI suggestions are provided as guidance only. You remain fully responsible for the final message. AI is a tool — not an author, advisor, or mediator.
                    </p>
                </div>

                {/* Point 6 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">06. Scheduled & Locked Deliveries</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        Some messages may be scheduled or temporarily sealed. You acknowledge that delivery timing depends on system availability, minor delays may occur, and once a sealed message is unlocked, it cannot be undone.
                    </p>
                </div>

                {/* Point 7 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">07. Payments & Refunds</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        Payments are processed via trusted third-party providers; VOW does not store payment details. Due to the personalized nature of the Service, payments are generally non-refundable once a message is generated. Exceptions may be considered for technical failures.
                    </p>
                </div>

                {/* Point 8 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">08. Availability & Service Changes</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        The Service is provided “as is.” Temporary downtime may occur for maintenance. VOW may update, modify, or discontinue features to improve the experience.
                    </p>
                </div>

                {/* Point 9 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">09. Limitation of Liability</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        VOW is not responsible for emotional outcomes, recipient reactions, relationship consequences, or losses caused by misuse. Our liability is limited to the amount paid for the specific use of the Service.
                    </p>
                </div>

                {/* Point 10 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">10. Privacy</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        Your use of VOW is governed by our Privacy Policy, which explains how data is handled, how encryption is applied, and your rights. Privacy is integral to these Terms.
                    </p>
                </div>

                {/* Point 11 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">11. Termination</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        We reserve the right to suspend access if these Terms are violated or required by law. You may stop using the Service at any time.
                    </p>
                </div>

                {/* Point 12 */}
                <div className="group">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">12. Governing Law (India)</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of Indian courts.
                    </p>
                </div>

                {/* Point 13 */}
                <div className="group border-b border-white/5 pb-6">
                    <h3 className="text-white text-[9px] uppercase tracking-[0.2em] font-bold mb-2">13. Contact</h3>
                    <p className="text-[#AAA] text-xs leading-relaxed">
                        For questions about these Terms, contact <span className="text-[#D4AF37]">support@vow.studio</span>.
                    </p>
                </div>

                {/* Closing Statement */}
                <div className="pt-4 text-center">
                    <p className="text-[#D4AF37] text-[9px] uppercase tracking-[0.2em] font-bold opacity-80">
                        "VOW exists to protect moments, not exploit them."
                    </p>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-[#0A0A0A] border-t border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <span className="text-[8px] uppercase tracking-widest text-[#666]">Last Updated: Feb 2026</span>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-3 border border-[#D4AF37]/30 text-[#D4AF37] text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-[#D4AF37] hover:text-black transition-all rounded-sm"
            >
               I Understand
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
