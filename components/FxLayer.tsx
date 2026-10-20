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
  const burstRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

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
    /* 补齐遗漏按钮：所有主要按钮自动获得磁吸委托，无需逐个手写 data-magnetic */
    const MAGNETIC_SELECTOR =
      '[data-magnetic], .btn, .btn-sm, .btn-ghost, .logout, .faq-question, .public-accept, .public-decline, button[type="submit"]';
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

      document.querySelectorAll<HTMLElement>(MAGNETIC_SELECTOR).forEach((el) => {
        if (!el.dataset.magnetic) el.dataset.magnetic = 'true';
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
        document.querySelectorAll<HTMLElement>(`[data-tilt],${MAGNETIC_SELECTOR}`).forEach((el) => {
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

    /* ---------- 4) Universal click burst (ripple particles on buttons) ---------- */
    const burstLayer = burstRef.current;
    const BURST_COLORS = ['#818cf8', '#a78bfa', '#38bdf8', '#34d399'];
    const onClickBurst = (e: MouseEvent) => {
      if (prefersReduced || !burstLayer) return;
      const t = e.target as HTMLElement | null;
      const host = t?.closest?.(
        '.btn, button, .logout, .faq-question, .public-accept, .public-decline, [data-magnetic]',
      ) as HTMLElement | null;
      if (!host || (host as HTMLButtonElement).disabled) return;
      const count = 10;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'fx-burst-particle';
        const ang = Math.random() * Math.PI * 2;
        const dist = 24 + Math.random() * 44;
        p.style.left = `${e.clientX}px`;
        p.style.top = `${e.clientY}px`;
        p.style.setProperty('--bx', `${(Math.cos(ang) * dist).toFixed(1)}px`);
        p.style.setProperty('--by', `${(Math.sin(ang) * dist).toFixed(1)}px`);
        p.style.setProperty('--bs', `${(3 + Math.random() * 4).toFixed(1)}px`);
        p.style.setProperty('--bd', `${(Math.random() * 0.35).toFixed(2)}s`);
        p.style.setProperty('--bc', BURST_COLORS[i % BURST_COLORS.length]);
        burstLayer.appendChild(p);
        window.setTimeout(() => p.remove(), 750);
      }
    };
    document.addEventListener('click', onClickBurst);

    /* ---------- 5) Cursor glow (soft light halo follows pointer) ---------- */
    const glow = glowRef.current;
    let glowRaf = 0;
    let glowCleanup: (() => void) | null = null;
    if (glow) {
      if (prefersReduced) {
        glow.style.display = 'none';
      } else {
        let gx = -9999;
        let gy = -9999;
        let tx = -9999;
        let ty = -9999;
        const onGlowMove = (e: MouseEvent) => {
          tx = e.clientX;
          ty = e.clientY;
        };
        const glowTick = () => {
          gx += (tx - gx) * 0.14;
          gy += (ty - gy) * 0.14;
          glow.style.transform = `translate(${gx - 150}px, ${gy - 150}px)`;
          glowRaf = requestAnimationFrame(glowTick);
        };
        window.addEventListener('mousemove', onGlowMove);
        glowRaf = requestAnimationFrame(glowTick);
        glowCleanup = () => {
          window.removeEventListener('mousemove', onGlowMove);
          cancelAnimationFrame(glowRaf);
        };
      }
    }

    /* ---------- 6) Top scroll progress bar ---------- */
    const bar = progressRef.current;
    let cleanupScroll: (() => void) | null = null;
    if (bar) {
      const update = () => {
        const sh = document.documentElement.scrollHeight - window.innerHeight;
        const p = sh > 0 ? Math.min(1, window.scrollY / sh) : 0;
        bar.style.width = `${(p * 100).toFixed(1)}%`;
      };
      update();
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      cleanupScroll = () => {
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }

    /* ---------- 7) Confetti celebration (window.__fxConfetti) ---------- */
    const CONFETTI_COLORS = ['#818cf8', '#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#f472b6'];
    const createConfetti = () => {
      if (!burstLayer) return;
      const count = 110;
      for (let i = 0; i < count; i++) {
        const c = document.createElement('span');
        c.className = 'fx-confetti-piece';
        const size = 6 + Math.random() * 6;
        c.style.left = `${(Math.random() * window.innerWidth).toFixed(0)}px`;
        c.style.width = `${size.toFixed(1)}px`;
        c.style.height = `${(size * (0.4 + Math.random() * 0.8)).toFixed(1)}px`;
        c.style.setProperty('--cd', `${(Math.random() * 0.8).toFixed(2)}s`);
        c.style.setProperty('--ct', `${(2.2 + Math.random() * 1.6).toFixed(2)}s`);
        c.style.setProperty('--cr', `${(Math.random() * 720).toFixed(0)}deg`);
        c.style.setProperty('--cc', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
        c.style.setProperty('--cw', `${Math.random() < 0.5 ? 1 : -1}`);
        burstLayer.appendChild(c);
        window.setTimeout(() => c.remove(), 3400);
      }
    };
    (window as unknown as { __fxConfetti?: () => void }).__fxConfetti = createConfetti;

    return () => {
      cancelAnimationFrame(raf);
      cleanupResize?.();
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('click', onClickBurst);
      glowCleanup?.();
      cleanupScroll?.();
    };
  }, []);

  return (
    <>
      <div aria-hidden className="fx-bg" />
      <div aria-hidden className="fx-grid" />
      <canvas ref={canvasRef} aria-hidden className="fx-particles" />
      <div ref={burstRef} aria-hidden className="fx-burst-layer" />
      <div ref={glowRef} aria-hidden className="fx-cursor-glow" />
      <div ref={progressRef} aria-hidden className="fx-scroll-progress" />
    </>
  );
}
