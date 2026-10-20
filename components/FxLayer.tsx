'use client';

import { useEffect, useRef } from 'react';

/**
 * FxLayer — global tech-glow layer for QuoteFollow.
 * SSR-safe: all DOM/browser APIs run inside useEffect only.
 * Respects prefers-reduced-motion: particles + magnetic + tilt disabled.
 *
 * Responsibilities:
 *  1. Canvas particle network background (fixed, pointer-events none).
 *  2. Delegated 3D tilt + cursor spotlight for any [data-tilt] element.
 *  3. Delegated magnetic hover for any [data-magnetic] element.
 *  4. Count-up + pop animation for .stat-value numbers.
 */
export default function FxLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1) Particle network ---------- */
    const canvas = canvasRef.current;
    let raf = 0;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; c: string }[] = [];
    let cleanupResize: (() => void) | null = null;

    if (canvas && !prefersReduced) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const COLORS = ['99,102,241', '139,92,246', '56,189,248'];

        const resize = () => {
          canvas.width = Math.floor(window.innerWidth * dpr);
          canvas.height = Math.floor(window.innerHeight * dpr);
          canvas.style.width = `${window.innerWidth}px`;
          canvas.style.height = `${window.innerHeight}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);
        cleanupResize = () => window.removeEventListener('resize', resize);

        const count = Math.min(64, Math.max(28, Math.floor(window.innerWidth / 24)));
        particles = Array.from({ length: count }, () => ({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          r: Math.random() * 1.6 + 0.6,
          c: COLORS[Math.floor(Math.random() * COLORS.length)],
        }));

        const LINK = 120;
        const step = () => {
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

          for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -20) p.x = window.innerWidth + 20;
            if (p.x > window.innerWidth + 20) p.x = -20;
            if (p.y < -20) p.y = window.innerHeight + 20;
            if (p.y > window.innerHeight + 20) p.y = -20;
          }

          for (let i = 0; i < particles.length; i++) {
            const a = particles[i];
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${a.c},0.5)`;
            ctx.fill();
            for (let j = i + 1; j < particles.length; j++) {
              const b = particles[j];
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < LINK * LINK) {
                const alpha = (1 - Math.sqrt(d2) / LINK) * 0.22;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(${a.c},${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          }
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }
    }

    /* ---------- 2) Delegated tilt + spotlight ---------- */
    const TILT_MAX = 6;
    const onMove = (e: MouseEvent) => {
      if (prefersReduced) return;
      const { clientX, clientY } = e;

      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const px = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        const rx = (py - 0.5) * -2 * TILT_MAX;
        const ry = (px - 0.5) * 2 * TILT_MAX;
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        el.style.setProperty('--fx-sx', `${(px * 100).toFixed(2)}%`);
        el.style.setProperty('--fx-sy', `${(py * 100).toFixed(2)}%`);
      });

      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dx = clientX - (r.left + r.width / 2);
        const dy = clientY - (r.top + r.height / 2);
        const max = 7;
        const mx = Math.max(-max, Math.min(max, dx * 0.18));
        const my = Math.max(-max, Math.min(max, dy * 0.18));
        el.style.setProperty('--mx', `${mx.toFixed(1)}px`);
        el.style.setProperty('--my', `${my.toFixed(1)}px`);
      });
    };

    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        document.querySelectorAll<HTMLElement>('[data-tilt],[data-magnetic]').forEach((el) => {
          el.style.transform = '';
          el.style.setProperty('--mx', '0px');
          el.style.setProperty('--my', '0px');
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);

    /* ---------- 3) Count-up + pop for .stat-value ---------- */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          io.unobserve(el);
          const raw = (el.textContent ?? '').trim();
          const m = raw.match(/^([^\d]*)([\d][\d.,]*)/);
          if (!m) return;
          const prefix = m[1] || '';
          const target = parseFloat(m[2].replace(/,/g, ''));
          const suffix = raw.slice(m[0].length);
          if (prefersReduced || !Number.isFinite(target)) {
            el.textContent = raw;
            return;
          }
          const dur = 700;
          const t0 = performance.now();
          const fmt = (v: number) =>
            Number.isInteger(target) ? Math.round(v).toLocaleString('en-US') : v.toFixed(2);
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = prefix + fmt(target * eased) + suffix;
            if (p < 1) {
              requestAnimationFrame(tick);
            } else {
              el.classList.add('fx-pop');
              window.setTimeout(() => el.classList.remove('fx-pop'), 900);
            }
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 },
    );

    const observeStats = () =>
      document.querySelectorAll<HTMLElement>('.stat-value').forEach((el) => {
        if (el.dataset.fxObserved !== '1') {
          el.dataset.fxObserved = '1';
          io.observe(el);
        }
      });
    observeStats();

    const mo = new MutationObserver(() => observeStats());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      cleanupResize?.();
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <>
      <div aria-hidden className="fx-bg" />
      <div aria-hidden className="fx-grid" />
      <canvas ref={canvasRef} aria-hidden className="fx-particles" />
    </>
  );
}
