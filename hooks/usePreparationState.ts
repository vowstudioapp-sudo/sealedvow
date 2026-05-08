import { useState, useCallback } from 'react';
import { CoupleData, Occasion, Coupon } from '../types';

// Single source of truth for the fresh-state shape. Used by both the
// initial useState() factory and resetPreparationState — same code path,
// no behavioral drift between mount and reset.
const buildInitialData = (initialCoupons: Coupon[]): CoupleData => ({
  sessionId: crypto.randomUUID(),

  recipientName: '',
  senderName: '',
  timeShared: '',
  relationshipIntent: 'Deeply romantic, grateful, and present.',
  sharedMoment: '',

  occasion: 'anniversary',
  writingMode: 'assisted',
  finalLetter: '',
  senderRawThoughts: '',

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
});

/**
 * usePreparationState
 *
 * Owns all PreparationForm state safely.
 * Prevents stale state bugs from setData({...data})
 * Keeps UI ceremonial and dumb.
 *
 * FINAL — Production Ready
 */
export function usePreparationState(
  initialCoupons: Coupon[] = [],
  initialStep: 1 | 2 | 3 = 1,
) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);

  const [data, setData] = useState<CoupleData>(() => buildInitialData(initialCoupons));

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

  // ---------------------------------------------------------------------------
  // RESET — for the "Begin again" flow in DraftResumeModal (PR #11).
  // Uses the SAME default-state factory as the initial useState call, so
  // reset is just "what would the hook return on a fresh mount". No new
  // sessionId logic is introduced — buildInitialData calls crypto.randomUUID()
  // because the original initial state did. Same code path, same behavior.
  // Caller is responsible for clearing localStorage separately.
  // ---------------------------------------------------------------------------
  const resetPreparationState = useCallback(() => {
    setData(buildInitialData(initialCoupons));
    setStep(1);
  }, [initialCoupons]);

  return {
    step,
    data,

    updateData,
    setOccasion,
    updateCoupon,

    next,
    back,
    setStep,

    resetPreparationState,
  };
}