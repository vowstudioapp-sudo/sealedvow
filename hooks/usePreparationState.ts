import { useState } from 'react';
import { CoupleData, Occasion, Coupon } from '../types';

/**
 * usePreparationState
 *
 * Owns all PreparationForm state safely.
 * Prevents stale state bugs from setData({...data})
 * Keeps UI ceremonial and dumb.
 *
 * FINAL — Production Ready
 */
export function usePreparationState(initialCoupons: Coupon[] = []) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [data, setData] = useState<CoupleData>(() => ({
    sessionId: crypto.randomUUID(),

    recipientName: '',
    senderName: '',
    timeShared: '',
    relationshipIntent: 'Deeply romantic, grateful, and present.',
    sharedMoment: '',

    occasion: 'valentine',
    writingMode: 'assisted',
    finalLetter: '',

    theme: 'obsidian',

    hasGift: false,
    giftType: 'gastronomy',
    giftTitle: '',
    giftLink: '',

    coupons: initialCoupons,

    musicType: 'preset',
    musicUrl: '',

    revealMethod: 'immediate',
    unlockDate: null,

    locationMemory: '',
    manualMapLink: '',

    memoryBoard: [],
  }));

  // ---------------------------------------------------------------------------
  // SAFE PATCH UPDATE (NO STATE LOSS)
  // Supports both object patches and functional updaters.
  // ---------------------------------------------------------------------------
  const updateData = (
    patch:
      | Partial<CoupleData>
      | ((prev: CoupleData) => Partial<CoupleData>)
  ) => {
    setData(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  };

  // ---------------------------------------------------------------------------
  // OCCASION LOGIC (BUSINESS RULES LIVE HERE)
  // ---------------------------------------------------------------------------
  const setOccasion = (occasion: Occasion, defaultTone?: string) => {
    setData(prev => ({
      ...prev,
      occasion,
      relationshipIntent: defaultTone ?? prev.relationshipIntent,
    }));
  };

  // ---------------------------------------------------------------------------
  // COUPON UPDATES (FULLY TYPE-SAFE)
  // ---------------------------------------------------------------------------
  const updateCoupon = <K extends keyof Coupon>(
    index: number,
    field: K,
    value: Coupon[K]
  ) => {
    setData(prev => {
      const coupons = [...(prev.coupons || [])];
      coupons[index] = { ...coupons[index], [field]: value };
      return { ...prev, coupons };
    });
  };

  // ---------------------------------------------------------------------------
  // STEP NAVIGATION (GUARDED)
  // ---------------------------------------------------------------------------
  const next = () =>
    setStep(s => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));

  const back = () =>
    setStep(s => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  return {
    step,
    data,

    updateData,
    setOccasion,
    updateCoupon,

    next,
    back,
    setStep,
  };
}