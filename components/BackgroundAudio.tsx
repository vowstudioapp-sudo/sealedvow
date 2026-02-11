import React, { useEffect, useRef, useState, useCallback } from 'react';

type MusicType = 'preset' | 'youtube';

interface BackgroundAudioProps {
  musicUrl?: string;
  musicType?: MusicType;
  isPlaying: boolean;
  volume?: number; // 0.0 – 1.0 (preset only)
  onPlayError?: (reason: 'AUTOPLAY_BLOCKED' | 'INVALID_SOURCE') => void;
}

/**
 * ENTERPRISE DESIGN NOTES
 * -----------------------
 * • One source of truth: `isPlaying`
 * • No autoplay attributes
 * • YouTube autoplay is muted by default (policy-safe)
 * • No iframe remounting for play/pause
 * • Explicit cleanup
 */

export const BackgroundAudio: React.FC<BackgroundAudioProps> = ({
  musicUrl,
  musicType = 'preset',
  isPlaying,
  volume = 0.4,
  onPlayError,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);

  /* ----------------------------------------
   * Utilities
   * ------------------------------------- */

  const extractYouTubeId = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.slice(1);
      }
      if (parsed.searchParams.has('v')) {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.includes('/embed/')) {
        return parsed.pathname.split('/embed/')[1];
      }
      return null;
    } catch {
      return null;
    }
  };

  const postYouTubeCommand = useCallback((command: 'playVideo' | 'pauseVideo') => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func: command,
        args: [],
      }),
      '*'
    );
  }, []);

  /* ----------------------------------------
   * Source Resolution
   * ------------------------------------- */

  useEffect(() => {
    if (musicType !== 'youtube' || !musicUrl) {
      setYoutubeId(null);
      return;
    }

    const id = extractYouTubeId(musicUrl);
    if (!id) {
      console.warn('[BackgroundAudio] Invalid YouTube URL');
      onPlayError?.('INVALID_SOURCE');
      setYoutubeId(null);
      return;
    }

    setYoutubeId(id);
  }, [musicType, musicUrl, onPlayError]);

  /* ----------------------------------------
   * Preset Audio Control
   * ------------------------------------- */

  useEffect(() => {
    if (musicType !== 'preset' || !audioRef.current) return;

    const audio = audioRef.current;
    audio.volume = Math.min(Math.max(volume, 0), 1);

    if (isPlaying) {
      audio
        .play()
        .catch(() => onPlayError?.('AUTOPLAY_BLOCKED'));
    } else {
      audio.pause();
    }
  }, [isPlaying, musicType, volume, onPlayError]);

  /* ----------------------------------------
   * YouTube Playback Control
   * ------------------------------------- */

  useEffect(() => {
    if (musicType !== 'youtube' || !youtubeId) return;

    if (isPlaying) {
      postYouTubeCommand('playVideo');
    } else {
      postYouTubeCommand('pauseVideo');
    }
  }, [isPlaying, musicType, youtubeId, postYouTubeCommand]);

  /* ----------------------------------------
   * Cleanup (SPA Safe)
   * ------------------------------------- */

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      postYouTubeCommand('pauseVideo');
    };
  }, [postYouTubeCommand]);

  /* ----------------------------------------
   * Render
   * ------------------------------------- */

  if (musicType === 'youtube' && youtubeId) {
    return (
      <div
        aria-hidden
        className="fixed top-0 left-0 w-1 h-1 overflow-hidden pointer-events-none"
        style={{ opacity: 0 }}
      >
        <iframe
          ref={iframeRef}
          title="Background Music"
          src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&playsinline=1&loop=1&playlist=${youtubeId}&controls=0&mute=1`}
          frameBorder={0}
          allow="autoplay; encrypted-media"
        />
      </div>
    );
  }

  if (musicType === 'preset' && musicUrl) {
    return (
      <audio
        ref={audioRef}
        src={musicUrl}
        loop
        preload="auto"
        playsInline
      />
    );
  }

  return null;
};