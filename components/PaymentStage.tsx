
import React, { useState, useEffect } from 'react';
import { CoupleData } from '../types';

interface Props {
  data: CoupleData;
  onPaymentComplete: () => void;
  onBack: () => void;
}

type Currency = 'USD' | 'AED' | 'INR' | 'EUR';
type PaymentMethod = 'card' | 'crypto';
type Tier = 'essence' | 'eternal';

const TIERS: Record<Tier, { name: string; priceUSD: number; features: string[] }> = {
  essence: {
    name: "Essence",
    priceUSD: 1.00,
    features: ["Digital Letter", "Audio Narration", "Upload Your Own Video", "Lifetime Hosting"]
  },
  eternal: {
    name: "Eternal",
    priceUSD: 4.99,
    features: ["Everything in Essence", "AI Generated Dreamscape (Veo)", "Priority Generation", "4K Assets"]
  }
};

const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  AED: 3.67,
  INR: 99.0, // Fixed rate for UX per user request
  EUR: 0.92
};

export const PaymentStage: React.FC<Props> = ({ data, onPaymentComplete, onBack }) => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [selectedTier, setSelectedTier] = useState<Tier>(data.videoSource === 'veo' ? 'eternal' : 'essence');
  const [isProcessing, setIsProcessing] = useState(false);

  // If video is included via Veo, force 'eternal' or at least default to it.
  useEffect(() => {
    if (data.videoSource === 'veo') {
      setSelectedTier('eternal');
    } else {
      setSelectedTier('essence');
    }
  }, [data.videoSource]);

  const handlePay = () => {
    setIsProcessing(true);
    // Simulation
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentComplete();
    }, 2500);
  };

  const getPrice = (tier: Tier) => {
    const base = TIERS[tier].priceUSD;
    // Special handling for INR to match specific request of 99 Rs
    if (currency === 'INR') {
        if (tier === 'essence') return '₹99';
        if (tier === 'eternal') return '₹499';
    }
    
    const converted = base * EXCHANGE_RATES[currency];
    const symbol = currency === 'USD' ? '$' : currency === 'AED' ? 'د.إ' : currency === 'EUR' ? '€' : '₹';
    return `${symbol}${converted.toFixed(2)}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in pb-32">
      <div className="bg-luxury-paper border border-[#D4C5A5] rounded-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden relative">
        
        {/* Header Section */}
        <div className="bg-[#1C1917] p-8 md:p-10 text-center relative">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-luxury-gold to-transparent opacity-50"></div>
           <div className="w-16 h-16 rounded-full bg-luxury-wine/30 border-2 border-luxury-gold/50 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl text-luxury-gold">💎</span>
           </div>
           <h2 className="text-[10px] uppercase tracking-[0.5em] text-luxury-gold font-bold mb-2">Finalize Your Gift</h2>
           <h1 className="text-3xl font-serif-elegant italic text-white">Select Your Legacy</h1>
        </div>

        <div className="p-6 md:p-12">
          
          {/* Tier Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
             {/* Essence Tier */}
             <div 
                onClick={() => setSelectedTier('essence')}
                className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 relative ${selectedTier === 'essence' ? 'bg-white border-luxury-ink shadow-lg scale-[1.02]' : 'bg-[#EBE7DE] border-transparent opacity-80 hover:opacity-100 hover:border-luxury-ink/20'}`}
             >
                <h3 className="text-xl font-serif-elegant italic text-luxury-ink mb-2">{TIERS.essence.name}</h3>
                <p className="text-3xl font-bold text-luxury-gold-dark mb-6">{getPrice('essence')}</p>
                <ul className="space-y-4">
                   {TIERS.essence.features.map(f => (
                     <li key={f} className="text-xs font-bold uppercase tracking-widest text-luxury-ink/80 flex items-center">
                       <span className="w-2 h-2 bg-luxury-ink/50 rounded-full mr-3"></span>{f}
                     </li>
                   ))}
                </ul>
                {selectedTier === 'essence' && <div className="absolute top-4 right-4 text-luxury-ink text-2xl font-bold">✓</div>}
             </div>

             {/* Eternal Tier */}
             <div 
                onClick={() => setSelectedTier('eternal')}
                className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 relative overflow-hidden ${selectedTier === 'eternal' ? 'bg-[#2A2522] border-luxury-gold shadow-xl scale-[1.02]' : 'bg-[#EBE7DE] border-transparent opacity-80 hover:opacity-100 hover:border-luxury-ink/20'}`}
             >
                <div className="absolute top-0 right-0 bg-luxury-gold text-[#1C1917] text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest">Recommended</div>
                <h3 className="text-xl font-serif-elegant italic text-white mb-2">{TIERS.eternal.name}</h3>
                <p className="text-3xl font-bold text-luxury-gold mb-6">{getPrice('eternal')}</p>
                <ul className="space-y-4">
                   {TIERS.eternal.features.map(f => (
                     <li key={f} className="text-xs font-bold uppercase tracking-widest text-white/90 flex items-center">
                       <span className="w-2 h-2 bg-luxury-gold rounded-full mr-3"></span>{f}
                     </li>
                   ))}
                </ul>
                {selectedTier === 'eternal' && <div className="absolute top-8 right-4 text-luxury-gold text-2xl font-bold">✓</div>}
             </div>
          </div>

          {data.videoSource === 'veo' && selectedTier === 'essence' && (
             <div className="mb-8 p-4 bg-red-50 border-2 border-red-200 rounded text-center text-red-800 text-xs font-bold">
                Warning: The "Essence" plan does not include AI Video generation. Your video will be removed.
             </div>
          )}

          {/* Payment Method Tabs */}
          <div className="flex border-b-2 border-luxury-ink/10 mb-8">
            <button 
              onClick={() => setMethod('card')}
              className={`flex-1 py-4 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase transition-colors ${method === 'card' ? 'text-luxury-wine border-b-4 border-luxury-wine' : 'text-luxury-stone/60'}`}
            >
              Card / UPI
            </button>
            <button 
              onClick={() => setMethod('crypto')}
              className={`flex-1 py-4 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase transition-colors ${method === 'crypto' ? 'text-luxury-wine border-b-4 border-luxury-wine' : 'text-luxury-stone/60'}`}
            >
              Crypto
            </button>
          </div>
          
          {/* Currency Selector */}
          {method === 'card' && (
            <div className="flex justify-center gap-3 mb-12">
              {(Object.keys(EXCHANGE_RATES) as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-2 rounded text-[10px] font-bold tracking-widest transition-all border-2 ${
                    currency === c 
                    ? 'bg-luxury-ink text-white border-luxury-ink' 
                    : 'bg-transparent text-luxury-ink/60 border-luxury-ink/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-6 max-w-sm mx-auto">
            <button 
              onClick={handlePay}
              disabled={isProcessing}
              className={`w-full py-5 rounded-full text-white font-bold text-[10px] md:text-xs tracking-[0.4em] uppercase shadow-2xl transition-all relative overflow-hidden flex items-center justify-center ${
                isProcessing ? 'bg-luxury-stone cursor-wait' : 'bg-luxury-wine hover:bg-black active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-3">
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   <span>Processing...</span>
                </div>
              ) : (
                <span>Pay {getPrice(selectedTier)}</span>
              )}
            </button>

            <button 
              onClick={onBack}
              className="w-full py-4 text-[10px] font-bold text-luxury-stone/60 uppercase tracking-[0.3em] hover:text-luxury-stone transition-colors"
            >
              ← Back to Preview
            </button>
          </div>
          
          {method === 'crypto' && (
             <p className="text-center text-[10px] text-gray-500 mt-8 break-all font-mono font-bold">
               0x71C7656EC7ab88b098defB751B7401B5f6d8976F (ETH)
             </p>
          )}

        </div>
      </div>
    </div>
  );
};
