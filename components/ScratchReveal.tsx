import React, { useEffect, useRef, useState } from 'react';

interface Props {
  revealContent: React.ReactNode;
  label?: string;
  onRevealed?: () => void;
  threshold?: number;
}

const SCRATCH_COLOR    = '#1B4332';
const SCRATCH_RADIUS   = 28;
const REVEAL_THRESHOLD = 0.60;

export const ScratchReveal: React.FC<Props> = ({
  revealContent,
  label,
  onRevealed,
  threshold = REVEAL_THRESHOLD,
}) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const isDrawing   = useRef(false);
  const revealed    = useRef(false);
  const lastCheck   = useRef(0);          // throttle pixel scan
  const [done, setDone] = useState(false);

  // ── GLOBAL MOUSEUP — prevents stuck isDrawing if cursor leaves canvas ──
  useEffect(() => {
    const stop = () => { isDrawing.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // ── CANVAS SETUP ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina / high-DPI fix — prevents blurry scratches on iPhone
    const dpr         = window.devicePixelRatio || 1;
    canvas.width      = 300 * dpr;
    canvas.height     = 120 * dpr;
    ctx.scale(dpr, dpr);

    // Fill overlay
    ctx.fillStyle = SCRATCH_COLOR;
    ctx.fillRect(0, 0, 300, 120);

    // Hint text — letterSpacing not supported in Canvas API, omitted
    ctx.fillStyle = 'rgba(212,175,55,0.6)';
    ctx.font      = 'bold 11px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(label ?? 'Scratch to reveal 🌙', 150, 52);
    ctx.font      = '18px Georgia';
    ctx.fillStyle = 'rgba(212,175,55,0.4)';
    ctx.fillText('✦', 150, 76);
  }, [label]);

  // ── PIXEL SCAN — throttled to 4×/sec, not 60×/sec ─────────────────
  function checkThreshold(canvas: HTMLCanvasElement) {
    const now = Date.now();
    if (now - lastCheck.current < 250) return;
    lastCheck.current = now;

    const ctx  = canvas.getContext('2d');
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
    }
    const pct = transparent / (canvas.width * canvas.height);

    if (pct >= threshold && !revealed.current) {
      revealed.current = true;
      completeReveal(canvas);
    }
  }

  // ── SCRATCH DRAWING ────────────────────────────────────────────────
  function scratch(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas || revealed.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(
      (x - rect.left) * scaleX,
      (y - rect.top)  * scaleY,
      SCRATCH_RADIUS * (window.devicePixelRatio || 1),
      0, Math.PI * 2,
    );
    ctx.fill();

    checkThreshold(canvas);
  }

  // ── AUTO COMPLETE — fade remaining overlay ─────────────────────────
  function completeReveal(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let alpha = 1;
    const fade = setInterval(() => {
      alpha -= 0.08;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (alpha <= 0) {
        clearInterval(fade);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        setDone(true);
        onRevealed?.();
      }
    }, 16);
  }

  // ── EVENTS ────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => { isDrawing.current = true;  scratch(e.clientX, e.clientY); };
  const onMouseMove = (e: React.MouseEvent) => { if (isDrawing.current) scratch(e.clientX, e.clientY); };
  const onMouseUp   = ()                    => { isDrawing.current = false; };

  const onTouchStart = (e: React.TouchEvent) => { e.preventDefault(); isDrawing.current = true;  scratch(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove  = (e: React.TouchEvent) => { e.preventDefault(); if (isDrawing.current) scratch(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchEnd   = ()                    => { isDrawing.current = false; };

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto', userSelect: 'none' }}>
      {/* Revealed content underneath */}
      <div style={{ width: '100%', height: 120, borderRadius: 12, background: 'rgba(27,67,50,0.6)', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {revealContent}
      </div>

      {/* Scratch overlay */}
      {!done && (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 12, cursor: 'pointer', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
      )}
    </div>
  );
};
