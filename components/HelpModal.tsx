import React, { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
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

  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                   </div>
                   <div>
                       <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-bold">VOW Support</h2>
                       <h1 className="text-xl font-serif-elegant italic text-white">Customer Support</h1>
                   </div>
                </div>
                <button onClick={onClose} className="text-[#666] hover:text-white transition-colors p-2">
                   ✕
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-6 text-center">
                <div className="space-y-4">
                    <a 
                      href="mailto:support@sealedvow.com"
                      className="block text-[#D4AF37] text-lg font-serif-elegant italic hover:text-white transition-colors"
                    >
                        📧 support@sealedvow.com
                    </a>
                    <a 
                      href="tel:+919654648484"
                      className="block text-[#D4AF37] text-lg font-serif-elegant italic hover:text-white transition-colors"
                    >
                        📱 +91 96546 48484
                    </a>
                    <p className="text-[#AAA] text-sm font-serif-elegant italic opacity-80 mt-6">
                        Response within 24 hours
                    </p>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#0A0A0A] border-t border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[8px] uppercase tracking-widest text-[#666]">Support Active</span>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-[#D4AF37] text-black text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-colors rounded-sm"
            >
               Close
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
