'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 轻量数字滚动：进入视口时从 0 滚到目标值（easeOutCubic）。
 * 系统开启减弱动态时直接显示最终值，不做滚动。
 */
export default function PriceRoll({
  value,
  prefix = '$',
  duration = 900,
}: {
  value: number;
  prefix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!started && entries[0]?.isIntersecting) {
          started = true;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min((t - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(eased * value));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="pricing-amount">
      {prefix}
      {display}
    </span>
  );
}
