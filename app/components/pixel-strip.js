'use client';

import { useEffect, useRef } from 'react';

const SETTINGS_KEY = 'ogenotes-pixel-strip-settings';
const PATTERNS = ['wave', 'sparkle', 'rain', 'pulse', 'heartbeat', 'geometry', 'glitch', 'orbit'];

function readSettings() {
  const defaults = { enabled: true, color: 'accent', mode: 'random', speed: 'normal', density: 'normal' };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function getAccent() {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue('--primary').trim();
  return value || '#ffffff';
}

export default function PixelStrip() {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return undefined;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return undefined;

    let settings = readSettings();
    let animationFrame = 0;
    let lastTime = 0;
    let patternStarted = 0;
    let pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    let previousPattern = pattern;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let dots = [];
    let lastPaint = 0;

    const choosePattern = () => {
      const choices = settings.mode === 'random' ? PATTERNS : [settings.mode];
      const available = choices.filter((item) => item !== previousPattern);
      pattern = (available.length ? available : choices)[Math.floor(Math.random() * (available.length || choices.length))];
      previousPattern = pattern;
      patternStarted = performance.now();
      dots = Array.from({ length: cols * rows }, () => Math.random());
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cell = settings.density === 'fine' ? 7 : settings.density === 'bold' ? 13 : 9;
      cols = Math.max(8, Math.floor(width / cell));
      rows = Math.max(3, Math.floor(height / cell));
      dots = Array.from({ length: cols * rows }, () => Math.random());
      context.fillStyle = '#050505';
      context.fillRect(0, 0, width, height);
    };

    const draw = (now) => {
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animationFrame = 0;
        return;
      }
      if (now - lastPaint < 1000 / (settings.speed === 'slow' ? 12 : settings.speed === 'fast' ? 30 : 20)) {
        animationFrame = requestAnimationFrame(draw);
        return;
      }
      lastPaint = now;
      if (settings.mode === 'random' && now - patternStarted > 6500 + Math.random() * 2500) choosePattern();

      context.fillStyle = '#050505';
      context.fillRect(0, 0, width, height);
      const accent = settings.color === 'white' ? '#ffffff' : getAccent();
      const cellW = width / cols;
      const cellH = height / rows;
      const t = now / (settings.speed === 'slow' ? 1100 : settings.speed === 'fast' ? 420 : 700);
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      const radius = Math.max(1, Math.min(cols, rows) / 2);
      const pixelSize = settings.density === 'bold' ? 3.4 : settings.density === 'fine' ? 2 : 2.7;

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const index = y * cols + x;
          const dx = x - cx;
          const dy = y - cy;
          const distance = Math.sqrt(dx * dx + dy * dy);
          let level = 0;
          if (pattern === 'wave') level = (Math.sin(x * 0.42 - t * 2 + Math.sin(y * 0.8)) + 1) / 2;
          if (pattern === 'sparkle') level = Math.max(0, Math.sin(t * 2 + dots[index] * 28)) * (dots[index] > 0.66 ? 1 : 0.12);
          if (pattern === 'rain') level = Math.max(0, Math.sin(y * 1.4 - t * 2.7 + x * 0.9)) * (Math.sin(x * 8.13) > 0.1 ? 1 : 0.08);
          if (pattern === 'pulse') level = Math.max(0, Math.sin(distance * 1.3 - t * 2.2)) * Math.max(0, 1 - distance / (radius * 1.5));
          if (pattern === 'heartbeat') {
            const phase = (t * 0.7) % (Math.PI * 2);
            const spike = Math.abs(x - cols * 0.5) < 2 && (Math.abs(y - rows * 0.5) < 2 || Math.abs(y - rows * 0.5) < 1 && Math.sin(phase * 2) > 0.8);
            level = spike ? 1 : Math.max(0, Math.sin(x * 0.5 - t) * 0.12);
          }
          if (pattern === 'geometry') level = Math.max(0, Math.sin((Math.abs(dx) + Math.abs(dy)) * 0.85 - t * 1.6)) * (Math.abs(dx) < cx * 0.9 && Math.abs(dy) < cy * 0.9 ? 1 : 0.12);
          if (pattern === 'glitch') level = Math.random() > 0.93 ? Math.random() : Math.max(0, Math.sin(x * 1.3 + y * 3.1 + t * 4)) * 0.22;
          if (pattern === 'orbit') {
            const angle = Math.atan2(dy, dx);
            const orbit = Math.sin(angle * 3 + distance * 0.6 - t * 2);
            level = Math.max(0, orbit) * (distance > radius * 0.25 && distance < radius * 1.35 ? 1 : 0.08);
          }
          level = Math.max(0, Math.min(1, level));
          if (level < 0.16) continue;
          const alpha = 0.2 + level * 0.8;
          context.globalAlpha = alpha;
          context.fillStyle = accent;
          context.fillRect(x * cellW + (cellW - pixelSize) / 2, y * cellH + (cellH - pixelSize) / 2, pixelSize, pixelSize);
        }
      }
      context.globalAlpha = 1;
      animationFrame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!settings.enabled || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!animationFrame) {
        patternStarted = performance.now();
        animationFrame = requestAnimationFrame(draw);
      }
    };
    const stop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
    const applySettings = () => {
      settings = readSettings();
      host.hidden = !settings.enabled;
      resize();
      if (settings.mode !== 'random') {
        pattern = settings.mode;
        previousPattern = pattern;
      } else choosePattern();
      stop();
      start();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    const onPreview = () => {
      settings = readSettings();
      choosePattern();
      stop();
      start();
    };
    const observer = new MutationObserver(() => {
      if (settings.color !== 'white') {
        // Repaint with the latest theme accent on the next animation frame.
        if (!animationFrame) start();
      }
    });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-primary', 'data-accent', 'data-theme'] });
    window.addEventListener('storage', applySettings);
    window.addEventListener('ogenotes-pixel-preview', onPreview);
    document.addEventListener('visibilitychange', onVisibility);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener?.('change', applySettings);
    host.hidden = !settings.enabled;
    resize();
    choosePattern();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      observer.disconnect();
      window.removeEventListener('storage', applySettings);
      window.removeEventListener('ogenotes-pixel-preview', onPreview);
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener?.('change', applySettings);
    };
  }, []);

  return (
    <div className="pixel-strip-wrap" ref={hostRef} aria-label="Animated pixel display" role="img">
      <canvas ref={canvasRef} className="pixel-strip-canvas" aria-hidden="true" />
      <span className="pixel-strip-sr">Decorative animated pixel display</span>
    </div>
  );
}
