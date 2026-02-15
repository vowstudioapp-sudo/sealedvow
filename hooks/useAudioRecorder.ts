import { useEffect, useRef, useState } from 'react';
import { CoupleData } from '../types';

// Firebase Storage SDK removed - uploads now handled via API routes
// This function is stubbed to prevent build errors
const uploadVoiceRecording = async (_sessionId: string, _blob: Blob): Promise<string> => {
  throw new Error('Voice recording uploads must be handled via API routes');
};

/**
 * useAudioRecorder
 *
 * Responsibilities:
 * - Handle microphone access
 * - Record voice safely
 * - Track recording duration
 * - Upload audio blob to Firebase Storage
 *
 * Rules:
 * - NO base64
 * - NO UI logic
 * - FULL cleanup on unmount
 */

const LIMITS = {
  AUDIO_MB: 2,
  MAX_SECONDS: 120, // hard safety cap (2 minutes)
} as const;

const MB = 1024 * 1024;

interface UseAudioRecorderParams {
  sessionId: string | null | undefined;
  updateData: (patch: Partial<CoupleData>) => void;
  onError: (message: string) => void;
}

export function useAudioRecorder({
  sessionId,
  updateData,
  onError,
}: UseAudioRecorderParams) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // ---------------------------------------------------------------------------
  // REFS (non-reactive, browser owned)
  // ---------------------------------------------------------------------------

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  const ensureSession = () => {
    if (!sessionId) {
      throw new Error('Recording session not initialized');
    }
    return sessionId;
  };

  const validateAudioSize = (blob: Blob) => {
    if (blob.size > LIMITS.AUDIO_MB * MB) {
      throw new Error(`Audio must be under ${LIMITS.AUDIO_MB}MB`);
    }
  };

  const cleanupStream = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // START RECORDING
  // ---------------------------------------------------------------------------

  const startRecording = async () => {
    if (isRecording) return;

    try {
      ensureSession();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsUploading(true);

        try {
          const audioBlob = new Blob(chunksRef.current, {
            type: 'audio/webm',
          });

          validateAudioSize(audioBlob);

          const url = await uploadVoiceRecording(
            ensureSession(),
            audioBlob
          );

          updateData({
            audio: { url, source: 'user' },
          });
        } catch (err: any) {
          onError(err.message || 'Voice upload failed');
        } finally {
          setIsUploading(false);
          cleanupStream();
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 >= LIMITS.MAX_SECONDS) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error: any) {
      // Better error messages based on error type
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        onError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        onError('Microphone access failed. Please check your device.');
      }
      cleanupStream();
    }
  };

  // ---------------------------------------------------------------------------
  // STOP RECORDING
  // ---------------------------------------------------------------------------

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    clearTimer();
  };

  // ---------------------------------------------------------------------------
  // DELETE RECORDING
  // ---------------------------------------------------------------------------

  const deleteRecording = () => {
    updateData({ audio: undefined });
    setRecordingTime(0);
  };

  // ---------------------------------------------------------------------------
  // CLEANUP ON UNMOUNT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }

      clearTimer();
      cleanupStream();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  return {
    // Controls
    startRecording,
    stopRecording,
    deleteRecording,

    // State
    isRecording,
    isUploading,
    recordingTime,

    // Helpers
    formatTime,

    // Limits (UI reference only)
    LIMITS,
  };
}