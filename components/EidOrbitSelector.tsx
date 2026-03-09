import React, { useEffect, useRef, useState } from 'react';
import '../styles/eid-orbit.css';

// ── Two rings: primary (inner, faster) and secondary (outer, slower) ──
const INNER_NODES = [
  { key: 'child-parent', title: 'Child → Parent', desc: 'For Ammi or Abu',          primary: true, glow: 1.2 },
  { key: 'parent-child', title: 'Parent → Child', desc: 'For your son or daughter', primary: true, glow: 1.1 },
];

const OUTER_NODES = [
  { key: 'elder-child',     title: 'Elder → Child',     desc: 'From Chacha, Mama, Khala', primary: false, glow: 0.9  },
  { key: 'sibling',         title: 'Sibling → Sibling', desc: 'Between Bhai and Behen',   primary: false, glow: 1.0  },
  { key: 'friend',          title: 'Friend → Friend',   desc: 'Just an Eid wish',         primary: false, glow: 0.95 },
  { key: 'relative-family', title: 'Relative → Family', desc: 'Eidi for the kids',        primary: false, glow: 1.05 },
];

const INNER_RADIUS = 125;  // SVG units (viewBox 500×500, center 250)
const OUTER_RADIUS = 182;
const INNER_STEP   = 360 / INNER_NODES.length;
const OUTER_STEP   = 360 / OUTER_NODES.length;
const ELLIPSE_X    = 1.12; // horizontal stretch for elliptical feel

export const EidOrbitSelector: React.FC = () => {
  const stageRef        = useRef<HTMLDivElement>(null);
  const innerSystemRef  = useRef<HTMLDivElement>(null);
  const outerSystemRef  = useRef<HTMLDivElement>(null);
  const innerTextRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const outerTextRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const innerDotRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const outerDotRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const innerConnRef    = useRef<SVGLineElement>(null);
  const outerConnRef    = useRef<SVGLineElement>(null);
  const bgRef           = useRef<HTMLDivElement>(null);

  const innerAngleRef   = useRef<number>(-90);
  const outerAngleRef   = useRef<number>(-60);  // offset so they don't start aligned
  const velocityRef     = useRef<number>(0);
  const rafRef          = useRef<number | null>(null);
  const pausedRef       = useRef<boolean>(false);
  const hiddenRef       = useRef<boolean>(false);
  const draggingRef     = useRef<boolean>(false);
  const dragStartXRef   = useRef<number>(0);
  const leaveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNodeRef   = useRef<{ ring: 'inner'|'outer', index: number } | null>(null);

  const [moonLabel,  setMoonLabel]  = useState<{ title: string; desc: string } | null>(null);
  const [activeKey,  setActiveKey]  = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // ── Place nodes at static angles — called once on mount and resize ──
  const placeNodes = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const W  = stage.offsetWidth;
    const H  = stage.offsetHeight;
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) / 500;

    const innerR = INNER_RADIUS * scale;
    const outerR = OUTER_RADIUS * scale;

    innerSystemRef.current?.querySelectorAll('.eid-orbit-node').forEach((node, i) => {
      const rad = (i * INNER_STEP) * (Math.PI / 180);
      (node as HTMLElement).style.left = cx + innerR * ELLIPSE_X * Math.cos(rad) + 'px';
      (node as HTMLElement).style.top  = cy + innerR * Math.sin(rad) + 'px';
    });

    outerSystemRef.current?.querySelectorAll('.eid-orbit-node').forEach((node, i) => {
      const rad = (i * OUTER_STEP) * (Math.PI / 180);
      (node as HTMLElement).style.left = cx + outerR * ELLIPSE_X * Math.cos(rad) + 'px';
      (node as HTMLElement).style.top  = cy + outerR * Math.sin(rad) + 'px';
    });
  };

  // ── Apply depth illusion: nodes in "back" are dimmer + smaller ──
  const applyDepth = (angle: number, dotRefs: React.MutableRefObject<(HTMLDivElement|null)[]>, step: number, glowArr: number[]) => {
    dotRefs.current.forEach((dot, i) => {
      if (!dot) return;
      const worldDeg = angle + i * step;
      const worldRad = worldDeg * (Math.PI / 180);
      const depth    = Math.sin(worldRad); // -1 (back) to +1 (front)
      const opacity  = 0.45 + 0.55 * (depth + 1) / 2;
      const sc       = (0.85 + 0.15 * (depth + 1) / 2) * glowArr[i];
      dot.style.opacity   = String(opacity.toFixed(3));
      dot.style.transform = `scale(${sc.toFixed(3)})`;
    });
  };

  // ── Rotate system + counter-rotate text + apply depth ──
  const applyRotation = (innerAngle: number, outerAngle: number) => {
    if (innerSystemRef.current) {
      innerSystemRef.current.style.transform = `rotate(${innerAngle}deg)`;
    }
    if (outerSystemRef.current) {
      outerSystemRef.current.style.transform = `rotate(${outerAngle}deg)`;
    }
    innerTextRefs.current.forEach(t => { if (t) t.style.transform = `rotate(${-innerAngle}deg)`; });
    outerTextRefs.current.forEach(t => { if (t) t.style.transform = `rotate(${-outerAngle}deg)`; });

    applyDepth(innerAngle, innerDotRefs, INNER_STEP, INNER_NODES.map(n => n.glow));
    applyDepth(outerAngle, outerDotRefs, OUTER_STEP, OUTER_NODES.map(n => n.glow));
  };

  // ── Connector line using current rotation angle ──
  const drawLine = (ring: 'inner'|'outer', index: number) => {
    const isInner = ring === 'inner';
    const line    = isInner ? innerConnRef.current : outerConnRef.current;
    const angle   = isInner ? innerAngleRef.current : outerAngleRef.current;
    const step    = isInner ? INNER_STEP : OUTER_STEP;
    const radius  = isInner ? INNER_RADIUS : OUTER_RADIUS;
    if (!line) return;
    const worldRad = (angle + index * step) * (Math.PI / 180);
    const sx = 250 + radius * ELLIPSE_X * Math.cos(worldRad);
    const sy = 250 + radius * Math.sin(worldRad);
    line.setAttribute('x2', String(sx.toFixed(1)));
    line.setAttribute('y2', String(sy.toFixed(1)));
    line.setAttribute('stroke', 'rgba(201,168,76,0.2)');
  };

  const clearLines = () => {
    innerConnRef.current?.setAttribute('stroke', 'rgba(201,168,76,0)');
    outerConnRef.current?.setAttribute('stroke', 'rgba(201,168,76,0)');
  };

  // ── Animation loop ──
  useEffect(() => {
    let lastTs = 0;

    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (ts - lastTs < 33) return;
      lastTs = ts;
      if (hiddenRef.current) return;

      if (!pausedRef.current) {
        // Different orbital speeds — inner faster (like planets closer to sun)
        innerAngleRef.current += 0.10;
        outerAngleRef.current += 0.05;
      } else if (velocityRef.current !== 0) {
        // Momentum decay after drag release
        innerAngleRef.current += velocityRef.current;
        outerAngleRef.current += velocityRef.current * 0.7; // outer slower even in inertia
        velocityRef.current   *= 0.96;
        if (Math.abs(velocityRef.current) < 0.01) velocityRef.current = 0;
      } else if (!draggingRef.current) {
        // Slow drift on hover
        innerAngleRef.current += 0.02;
        outerAngleRef.current += 0.01;
      }

      applyRotation(innerAngleRef.current, outerAngleRef.current);

      // Keep connector line tracking the active node
      if (activeNodeRef.current) {
        drawLine(activeNodeRef.current.ring, activeNodeRef.current.index);
      }
    };

    const onVisibility = () => { hiddenRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        placeNodes();
        applyRotation(innerAngleRef.current, outerAngleRef.current);
        rafRef.current = requestAnimationFrame(tick);
      });
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ── Drag with inertia ──
  useEffect(() => {
    let lastDelta = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = (e.clientX - dragStartXRef.current) * 0.25;
      lastDelta = delta;
      innerAngleRef.current += delta;
      outerAngleRef.current += delta * 0.7;
      applyRotation(innerAngleRef.current, outerAngleRef.current);
      dragStartXRef.current = e.clientX;
    };
    const onMouseUp = () => {
      if (draggingRef.current) velocityRef.current = lastDelta; // carry momentum
      draggingRef.current = false;
      pausedRef.current   = false;
    };
    const onWindowBlur = () => { draggingRef.current = false; pausedRef.current = false; velocityRef.current = 0; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp, true);
    window.addEventListener('blur',      onWindowBlur);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp, true);
      window.removeEventListener('blur',      onWindowBlur);
    };
  }, []);

  // ── Resize ──
  useEffect(() => {
    const onResize = () => { placeNodes(); applyRotation(innerAngleRef.current, outerAngleRef.current); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Parallax ──
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const move = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      if (bgRef.current) {
        bgRef.current.style.setProperty('--px', `${x * 20}px`);
        bgRef.current.style.setProperty('--py', `${y * 20}px`);
      }
    };
    stage.addEventListener('mousemove', move);
    return () => stage.removeEventListener('mousemove', move);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    draggingRef.current   = true;
    pausedRef.current     = true;
    velocityRef.current   = 0;
    dragStartXRef.current = e.clientX;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    draggingRef.current   = true;
    pausedRef.current     = true;
    velocityRef.current   = 0;
    dragStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const delta = (e.touches[0].clientX - dragStartXRef.current) * 0.35;
    innerAngleRef.current += delta;
    outerAngleRef.current += delta * 0.7;
    applyRotation(innerAngleRef.current, outerAngleRef.current);
    dragStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd    = () => { draggingRef.current = false; pausedRef.current = false; };
  const handleTouchCancel = () => { draggingRef.current = false; pausedRef.current = false; };

  const handleNodeEnter = (ring: 'inner'|'outer', i: number, node: typeof INNER_NODES[0]) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    pausedRef.current  = true;
    activeNodeRef.current = { ring, index: i };
    setActiveKey(node.key);
    setMoonLabel({ title: node.title, desc: node.desc });
    setPreviewKey(node.key);
    drawLine(ring, i);
  };

  const handleStageLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      pausedRef.current     = false;
      activeNodeRef.current = null;
      setActiveKey(null);
      setMoonLabel(null);
      setPreviewKey(null);
      clearLines();
    }, 150);
  };

  const handleStageEnter = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  };

  const navigate = (key: string) => { window.location.href = '/demo/eid/' + key; };
  const allNodes = [...INNER_NODES, ...OUTER_NODES];
  const activeNodeData = allNodes.find(n => n.key === previewKey);

  const handleNodeClick = (key: string) => {
    const isTouch = window.matchMedia('(hover: none)').matches;
    if (isTouch && previewKey !== key) {
      const node = allNodes.find(n => n.key === key);
      if (!node) return;
      setPreviewKey(key);
      setActiveKey(key);
      setMoonLabel({ title: node.title, desc: node.desc });
      pausedRef.current = true;
    } else {
      navigate(key);
    }
  };

  const renderNode = (
    node: typeof INNER_NODES[0],
    i: number,
    ring: 'inner'|'outer',
    textRefs: React.MutableRefObject<(HTMLDivElement|null)[]>,
    dotRefs: React.MutableRefObject<(HTMLDivElement|null)[]>,
  ) => (
    <div
      key={node.key}
      className={`eid-orbit-node ${activeKey === node.key ? 'eid-orbit-node--active' : ''} ${node.primary ? 'eid-orbit-node--primary' : ''}`}
      onMouseEnter={() => handleNodeEnter(ring, i, node)}
      onClick={() => handleNodeClick(node.key)}
    >
      <div className="eid-orbit-node__dot" ref={el => { dotRefs.current[i] = el; }} />
      <div className="eid-orbit-node__text" ref={el => { textRefs.current[i] = el; }}>
        <span className="eid-orbit-node__title">{node.title}</span>
        <span className="eid-orbit-node__desc">{node.desc}</span>
      </div>
    </div>
  );

  return (
    <div className="eid-orbit-page">
      <div className="eid-orbit-bg" ref={bgRef} />

      <button className="eid-orbit-back" onClick={() => { window.location.href = '/'; }}>
        ← Back
      </button>

      <div className="eid-orbit-header">
        <p className="eid-orbit-eyebrow">✦ &nbsp; Eid ul-Fitr &nbsp; ✦</p>
        <h1 className="eid-orbit-title">Eid Mubarak</h1>
        <p className="eid-orbit-subtitle">
          Send Eid wishes. Add Eidi if you want.<br />
          <span className="eid-orbit-subtitle__hint">Preview how your message will appear.</span>
        </p>
      </div>

      <div className="eid-orbit-interactive" onMouseLeave={handleStageLeave} onMouseEnter={handleStageEnter}>
        <div
          className="eid-orbit-stage"
          ref={stageRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          {/* Static SVG rings + connectors */}
          <svg className="eid-orbit-ring" viewBox="0 0 500 500">
            {/* Outer ring */}
            <ellipse cx="250" cy="250" rx={OUTER_RADIUS * ELLIPSE_X} ry={OUTER_RADIUS}
              fill="none" stroke="rgba(201,168,76,0.18)" strokeWidth="1.2"/>
            <ellipse cx="250" cy="250" rx={OUTER_RADIUS * ELLIPSE_X} ry={OUTER_RADIUS}
              fill="none" stroke="rgba(201,168,76,0.05)" strokeWidth="7"/>
            {/* Inner ring */}
            <ellipse cx="250" cy="250" rx={INNER_RADIUS * ELLIPSE_X} ry={INNER_RADIUS}
              fill="none" stroke="rgba(201,168,76,0.22)" strokeWidth="1"/>
            {/* Connectors */}
            <line ref={innerConnRef} x1="250" y1="250" x2="250" y2="250"
              stroke="rgba(201,168,76,0)" strokeWidth="1"
              style={{ transition: 'stroke 0.3s ease' }}/>
            <line ref={outerConnRef} x1="250" y1="250" x2="250" y2="250"
              stroke="rgba(201,168,76,0)" strokeWidth="1"
              style={{ transition: 'stroke 0.3s ease' }}/>
          </svg>

          {/* Moon — fixed, never moves */}
          <div className="eid-orbit-moon">
            <svg width="72" height="72" viewBox="0 0 80 80" fill="none">
              <defs>
                <radialGradient id="moonGrad" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#f5e090"/>
                  <stop offset="100%" stopColor="#c8900a"/>
                </radialGradient>
              </defs>
              <path fillRule="evenodd" clipRule="evenodd"
                d="M40 7 A33 33 0 1 1 39.9 7 A21 21 0 1 0 40.1 7 Z"
                fill="url(#moonGrad)"/>
            </svg>
            <div className="eid-orbit-moon__label">
              {moonLabel ? (
                <>
                  <span className="eid-orbit-moon__rel">{moonLabel.title}</span>
                  <span className="eid-orbit-moon__desc">{moonLabel.desc}</span>
                </>
              ) : (
                <span className="eid-orbit-moon__rel">Eid Mubarak</span>
              )}
            </div>
          </div>

          {/* Inner ring system */}
          <div className="eid-orbit-system" ref={innerSystemRef}>
            {INNER_NODES.map((node, i) => renderNode(node, i, 'inner', innerTextRefs, innerDotRefs))}
          </div>

          {/* Outer ring system */}
          <div className="eid-orbit-system" ref={outerSystemRef}>
            {OUTER_NODES.map((node, i) => renderNode(node, i, 'outer', outerTextRefs, outerDotRefs))}
          </div>

        </div>

        <p className={`eid-orbit-hint ${previewKey ? 'eid-orbit-hint--hidden' : ''}`}>
          Hover or tap a relationship
        </p>

        <div className={`eid-orbit-preview ${previewKey ? 'eid-orbit-preview--show' : ''}`}>
          {activeNodeData && <p className="eid-orbit-preview__title">{activeNodeData.desc}</p>}
          <button className="eid-orbit-preview__btn"
            onClick={() => previewKey && navigate(previewKey)}>
            Preview Experience →
          </button>
        </div>

      </div>
    </div>
  );
};