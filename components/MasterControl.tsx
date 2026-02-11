import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { CoupleData } from '../types';
import {
  unlockSession,
  updateSyncState,
  listenToSyncState,
} from '../services/firebase';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  data: CoupleData;
}

/* ------------------------------------------------------------------ */
/* CONSTANTS (NO MAGIC NUMBERS)                                         */
/* ------------------------------------------------------------------ */

const SYNC_TICK_MS = 20;

const SYNC_INCREMENT_WITH_PARTNER = 1.2;
const SYNC_INCREMENT_SOLO = 0.5;

const SYNC_CAP_SOLO = 50;
const SYNC_CAP_FULL = 100;

const SYNC_DECAY_RATE = 3;

const SYNC_BUTTON_SIZE = 160;
const SYNC_RING_RADIUS = 78;
const SYNC_RING_CIRCUMFERENCE = 2 * Math.PI * SYNC_RING_RADIUS;

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const MasterControl: React.FC<Props> = ({ data }) => {
  const method = data.revealMethod || 'remote';

  /* ------------------------------------------------------------------ */
  /* STATE                                                               */
  /* ------------------------------------------------------------------ */

  const [isTriggered, setIsTriggered] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isPressingSync, setIsPressingSync] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false);

  /* ------------------------------------------------------------------ */
  /* REFS (LIFECYCLE + SAFETY)                                           */
  /* ------------------------------------------------------------------ */

  const intervalRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const hasTriggeredRef = useRef(false);

  /* ------------------------------------------------------------------ */
  /* MOUNT / UNMOUNT SAFETY                                              */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* SYNC MODE: LISTEN TO PARTNER                                        */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (method !== 'sync' || !data.sessionId) return;

    const unsubscribe = listenToSyncState(
      data.sessionId,
      (syncData) => {
        if (!isMountedRef.current) return;
        setPartnerActive(Boolean(syncData.receiver));
      }
    );

    return () => unsubscribe();
  }, [method, data.sessionId]);

  /* ------------------------------------------------------------------ */
  /* SYNC PRESS HANDLING                                                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (method !== 'sync' || !data.sessionId) return;

    if (isPressingSync) {
      updateSyncState(data.sessionId, 'sender', true);

      if (intervalRef.current) return;

      intervalRef.current = window.setInterval(() => {
        setSyncProgress((prev) => {
          if (!partnerActive) {
            return Math.min(prev + SYNC_INCREMENT_SOLO, SYNC_CAP_SOLO);
          }
          return Math.min(prev + SYNC_INCREMENT_WITH_PARTNER, SYNC_CAP_FULL);
        });
      }, SYNC_TICK_MS);
    } else {
      updateSyncState(data.sessionId, 'sender', false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setSyncProgress((prev) => Math.max(0, prev - SYNC_DECAY_RATE));
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPressingSync, partnerActive, method, data.sessionId]);

  /* ------------------------------------------------------------------ */
  /* SYNC COMPLETION DETECTION                                           */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (
      syncProgress >= SYNC_CAP_FULL &&
      !hasTriggeredRef.current
    ) {
      hasTriggeredRef.current = true;
      setIsTriggered(true);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (data.sessionId) {
        unlockSession(data.sessionId);
      }
    }
  }, [syncProgress, data.sessionId]);

  /* ------------------------------------------------------------------ */
  /* REMOTE MODE HANDLER                                                 */
  /* ------------------------------------------------------------------ */

  const handleRemoteTrigger = useCallback(() => {
    if (isTriggered || hasTriggeredRef.current) return;

    hasTriggeredRef.current = true;
    setIsTriggered(true);

    if (data.sessionId) {
      unlockSession(data.sessionId);
    }
  }, [isTriggered, data.sessionId]);

  /* ------------------------------------------------------------------ */
  /* POINTER HANDLERS (SYNC)                                             */
  /* ------------------------------------------------------------------ */

  const handlePressStart = () => {
    if (!isTriggered) setIsPressingSync(true);
  };

  const handlePressEnd = () => {
    setIsPressingSync(false);
  };

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="master-control">
      <div className="master-control-ambient-bg" />

      <div className="master-control-header">
        <p className="master-control-eyebrow">Master Key Access</p>
        <h1 className="master-control-title">
          {method === 'sync' ? 'Sync Required' : 'Command Center'}
        </h1>
      </div>

      {/* REMOTE MODE */}
      {method === 'remote' && (
        <div className="master-control-remote">
          <button
            onClick={handleRemoteTrigger}
            disabled={isTriggered}
            className={`master-control-remote-button ${
              isTriggered ? 'is-triggered' : ''
            }`}
          >
            {isTriggered ? 'SENT' : 'UNLOCK'}
          </button>

          <p className="master-control-hint">
            {isTriggered
              ? 'Signal transmitted.'
              : 'Tap to reveal on their screen.'}
          </p>
        </div>
      )}

      {/* SYNC MODE */}
      {method === 'sync' && (
        <div className="master-control-sync">
          <div className="master-control-sync-button-wrapper">
            <div
              className={`master-control-sync-glow ${
                isPressingSync ? 'is-active' : ''
              }`}
              style={{
                ['--glow-scale' as any]:
                  1 + syncProgress / 40,
              }}
            />

            <button
              onPointerDown={handlePressStart}
              onPointerUp={handlePressEnd}
              onPointerCancel={handlePressEnd}
              disabled={isTriggered}
              className={`master-control-sync-button ${
                isPressingSync ? 'is-pressing' : ''
              }`}
            >
              ❦

              <svg
                className="master-control-sync-ring"
                width={SYNC_BUTTON_SIZE}
                height={SYNC_BUTTON_SIZE}
              >
                <circle
                  cx={SYNC_BUTTON_SIZE / 2}
                  cy={SYNC_BUTTON_SIZE / 2}
                  r={SYNC_RING_RADIUS}
                  strokeDasharray={SYNC_RING_CIRCUMFERENCE}
                  strokeDashoffset={
                    SYNC_RING_CIRCUMFERENCE *
                    (1 - syncProgress / 100)
                  }
                />
              </svg>
            </button>
          </div>

          <div className="master-control-sync-status">
            {isTriggered ? (
              <p className="status-unlocked">UNLOCKED</p>
            ) : (
              <>
                <p
                  className={
                    partnerActive
                      ? 'status-partner-active'
                      : 'status-waiting'
                  }
                >
                  {partnerActive
                    ? 'Partner Ready...'
                    : 'Waiting for partner...'}
                </p>

                {isPressingSync && !partnerActive && (
                  <p className="status-warning">
                    They must touch too
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* VIGIL MODE */}
      {method === 'vigil' && (
        <p className="master-control-vigil">
          The vigil is active. No action needed.
        </p>
      )}
    </div>
  );
};