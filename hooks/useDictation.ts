import { useEffect, useRef, useState } from 'react';

/**
 * useDictation
 *
 * Handles browser speech recognition for dictating text.
 * Uses Web Speech API (Chrome/Edge/Safari).
 *
 * Responsibilities:
 * - Check browser support
 * - Start/stop continuous dictation
 * - Return transcript to caller
 * - Clean up on unmount
 *
 * Rules:
 * - NO state mutation (caller owns the text)
 * - NO UI logic
 * - FULL cleanup on unmount
 */

interface UseDictationParams {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

export function useDictation({
  onTranscript,
  onError,
}: UseDictationParams) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [isDictating, setIsDictating] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // ---------------------------------------------------------------------------
  // REFS
  // ---------------------------------------------------------------------------

  const recognitionRef = useRef<any>(null);

  // ---------------------------------------------------------------------------
  // CHECK BROWSER SUPPORT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    setIsSupported(!!SpeechRecognition);
  }, []);

  // ---------------------------------------------------------------------------
  // CLEANUP ON UNMOUNT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped, ignore
        }
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // START DICTATION
  // ---------------------------------------------------------------------------

  const startDictation = () => {
    if (!isSupported) {
      onError('Speech recognition not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    if (isDictating) return;

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognition();

      // Configuration
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      // Handle results
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result: any) => result[0].transcript)
          .join(' ');

        if (transcript.trim()) {
          onTranscript(transcript);
        }
      };

      // Handle errors
      recognition.onerror = (event: any) => {
        setIsDictating(false);

        if (event.error === 'no-speech') {
          onError('No speech detected. Please try again.');
        } else if (event.error === 'not-allowed') {
          onError('Microphone access denied. Please allow microphone access.');
        } else {
          onError('Dictation error. Please try again.');
        }
      };

      // Handle end
      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
    } catch (error) {
      onError('Failed to start dictation. Please try again.');
    }
  };

  // ---------------------------------------------------------------------------
  // STOP DICTATION
  // ---------------------------------------------------------------------------

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      setIsDictating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  return {
    // Controls
    startDictation,
    stopDictation,

    // State
    isDictating,
    isSupported,
  };
}