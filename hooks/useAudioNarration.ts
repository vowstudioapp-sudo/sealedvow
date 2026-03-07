/**
 * useAudioNarration — Manages Web Audio lifecycle for letter narration.
 *
 * Handles: user-uploaded audio OR AI-generated audio from letter text.
 * Returns: audioBuffer, isPlaying state, and togglePlay function.
 * Cleanup: Stops source node and closes AudioContext on unmount.
 *
 * Extracted from MainExperience.tsx — zero logic changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateAudioLetter, decodeAudioData } from '../services/geminiService';

interface AudioNarrationResult {
  audioBuffer: AudioBuffer | null;
  isVoicePlaying: boolean;
  toggleVoiceNote: (e?: React.MouseEvent) => void;
}

export function useAudioNarration(
  finalLetter: string | undefined,
  audioUrl: string | undefined
): AudioNarrationResult {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const mountedRef = useRef(true);
  // Guards against stale AI responses overwriting newer audio
  const generationIdRef = useRef(0);

  // ── Audio Preparation + Cleanup ──
  useEffect(() => {
    mountedRef.current = true;
    // Increment generation ID — any in-flight response from a previous
    // render will see a mismatched ID and discard its result.
    const thisGeneration = ++generationIdRef.current;

    // Close previous AudioContext before creating a new one.
    // Without this, re-renders (e.g. letter regeneration) leak contexts.
    // Some browsers (Safari) hard-limit the number of active contexts.
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) { /* already stopped */ }
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { /* already closed */ }
      audioContextRef.current = null;
    }
    setAudioBuffer(null);
    setIsVoicePlaying(false);

    const prepareAudio = async () => {
      if (!mountedRef.current) return;

      // User-uploaded audio
      if (audioUrl) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
          const fetchResponse = await fetch(audioUrl);
          const arrayBuffer = await fetchResponse.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          // Guard: only set buffer if this is still the current generation
          if (mountedRef.current && generationIdRef.current === thisGeneration) {
            setAudioBuffer(buffer);
          }
        } catch (e) {
          console.error("User audio failed", e);
        }
        return;
      }

      // AI-generated audio
      if (!finalLetter) return;
      try {
        const audioBytes = await generateAudioLetter(finalLetter);
        // Guard: discard if a newer generation started while we were fetching
        if (!audioBytes || !mountedRef.current || generationIdRef.current !== thisGeneration) return;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        const buffer = await decodeAudioData(audioBytes, ctx);
        if (mountedRef.current && generationIdRef.current === thisGeneration) {
          setAudioBuffer(buffer);
        }
      } catch (e) {
        console.error("AI audio ignored", e);
      }
    };

    prepareAudio();

    return () => {
      mountedRef.current = false;
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) { /* Ignore */ }
        sourceNodeRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { /* Ignore */ }
        audioContextRef.current = null;
      }
    };
  }, [finalLetter, audioUrl]);

  // ── Toggle Play/Stop ──
  // Uses ref to read current playing state without adding it to dependency array.
  // This prevents the callback from being recreated on every play/pause toggle.
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isVoicePlaying;

  const toggleVoiceNote = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlayingRef.current) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) { /* Ignore */ }
        sourceNodeRef.current = null;
      }
      setIsVoicePlaying(false);
    } else {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      // Stop any existing source before creating new one
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) { /* Ignore */ }
        sourceNodeRef.current = null;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsVoicePlaying(false);
        sourceNodeRef.current = null;
      };
      source.start(0);
      sourceNodeRef.current = source;
      setIsVoicePlaying(true);
    }
  }, [audioBuffer]);

  return { audioBuffer, isVoicePlaying, toggleVoiceNote };
}