import React, { useState, useEffect, useRef } from 'react';
import { CoupleData } from '../types';

interface Props {
  data: CoupleData;
  onPaymentComplete: () => void;
  onBack: () => void;
}

const FEATURES = [
  "AI-Crafted Personal Letter",
  "Audio Narration",
  "Memory Board Gallery",
  "Interactive Envelope Experience",
  "Lifetime Hosting",
  "Private Shareable Link",
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) { resolve(true); return; }
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const PaymentStage: React.FC<Props> = ({ data, onPaymentComplete, onBack }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const paymentInProgressRef = useRef(false);

  useEffect(() => { loadRazorpayScript().then(setScriptLoaded); }, []);

  const handlePay = async () => {
    if (paymentInProgressRef.current || isProcessing) return;
    paymentInProgressRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      if (!scriptLoaded) {
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error('Payment system failed to load. Please refresh.');
        setScriptLoaded(true);
      }

      // Create order — no body needed, server determines amount
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create payment order.');
      }

      const { orderId, amount, currency, keyId } = await orderRes.json();

      await openCheckout({ orderId, amount, currency, keyId });

    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
      paymentInProgressRef.current = false;
    }
  };

  const openCheckout = ({ orderId, amount, currency, keyId }: {
    orderId: string; amount: number; currency: string; keyId: string;
  }): Promise<void> => {
    return new Promise((resolve, reject) => {
      const options = {
        key: keyId,
        amount,
        currency,
        name: 'Sealed Vow',
        description: 'Private Expression — Standard',
        order_id: orderId,
        prefill: { name: data.senderName || '' },
        theme: { color: '#722F37' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                sessionKey: data.sessionId || null,
              }),
            });
            const result = await verifyRes.json();
            if (result.verified) { onPaymentComplete(); resolve(); }
            else { reject(new Error('Payment verification failed. Please contact support.')); }
          } catch {
            reject(new Error('Verification failed. Please check your connection.'));
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled.')),
          escape: true,
          confirm_close: true,
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (r: any) => reject(new Error(r?.error?.description || 'Payment failed.')));
      rzp.open();
    });
  };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-8 animate-fade-in pb-32">
      <div className="bg-luxury-paper border border-[#D4C5A5] rounded-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden">

        {/* Header */}
        <div className="bg-[#1C1917] p-8 md:p-10 text-center relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-luxury-gold to-transparent opacity-50"></div>
          <div className="w-16 h-16 rounded-full bg-luxury-wine/30 border-2 border-luxury-gold/50 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl text-luxury-gold">💎</span>
          </div>
          <h2 className="text-[10px] uppercase tracking-[0.5em] text-luxury-gold font-bold mb-2">Finalize Your Gift</h2>
          <h1 className="text-3xl font-serif-elegant italic text-white">Sealed Vow</h1>
          <p className="text-4xl font-bold text-luxury-gold mt-4">₹99</p>
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 mt-2">One-time · Lifetime access</p>
        </div>

        <div className="p-6 md:p-10">

          {/* Error */}
          {error && (
            <div
              className="mb-6 p-4 bg-[#2B0A0A]/80 border border-red-400/30 text-red-200 text-[11px] tracking-wide rounded-lg text-center cursor-pointer"
              onClick={() => setError(null)}
            >
              {error}
              <span className="block text-[9px] text-red-300/50 mt-1 uppercase tracking-widest">Tap to dismiss</span>
            </div>
          )}

          {/* Features */}
          <div className="mb-10 space-y-4">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center text-xs font-bold uppercase tracking-widest text-luxury-ink/80">
                <span className="w-2 h-2 bg-luxury-gold rounded-full mr-3 flex-shrink-0"></span>{f}
              </div>
            ))}
          </div>

          {/* Pay Button */}
          <div className="space-y-5">
            <button
              onClick={handlePay}
              disabled={isProcessing || !scriptLoaded}
              className={`w-full py-5 rounded-full text-white font-bold text-[10px] md:text-xs tracking-[0.4em] uppercase shadow-2xl transition-all flex items-center justify-center ${
                isProcessing ? 'bg-luxury-stone cursor-wait' : !scriptLoaded ? 'bg-luxury-stone/50 cursor-not-allowed' : 'bg-luxury-wine hover:bg-black active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : !scriptLoaded ? (
                <span>Loading Payment...</span>
              ) : (
                <span>Pay ₹99</span>
              )}
            </button>

            <button
              onClick={onBack}
              disabled={isProcessing}
              className="w-full py-4 text-[10px] font-bold text-luxury-stone/60 uppercase tracking-[0.3em] hover:text-luxury-stone transition-colors"
            >
              ← Back to Preview
            </button>
          </div>

          {/* Security */}
          <div className="mt-10 text-center">
            <p className="text-[9px] uppercase tracking-[0.3em] text-luxury-stone/40 font-bold">
              🔒 Secured by Razorpay · PCI DSS Compliant · 256-bit Encryption
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};