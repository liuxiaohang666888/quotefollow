'use client';

import { useState } from 'react';
import { MorphIcon } from 'morphicons/react';
import type { IconNode } from 'morphicons/react';

/**
 * 线性图标 + hover 弹簧形变（morphicons，MIT）。
 * 每个 iconKey 维护一对 [常态, hover 目标]，hover 时在两者间 morph。
 * reducedMotion="user"：系统开启减弱动态时退化为瞬时切换。
 */
const PAIRS: Record<string, [IconNode, IconNode]> = {
  chat: [
    [['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }]],
    [
      ['path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }],
      ['path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }],
    ],
  ],
  clock: [
    [
      ['circle', { cx: '12', cy: '12', r: '9' }],
      ['path', { d: 'M12 7v5l3 2' }],
    ],
    [
      ['path', { d: 'M12 20V10' }],
      ['path', { d: 'M18 20V4' }],
      ['path', { d: 'M6 20v-6' }],
    ],
  ],
  flame: [
    [['path', { d: 'M3 12h4l3-8 4 16 3-8h4' }]],
    [['path', { d: 'M13 2 3 14h9l-1 8 10-12h-9z' }]],
  ],
  reply: [
    [['polyline', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }]],
    [['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }]],
  ],
  bell: [
    [
      ['path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }],
      ['path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }],
    ],
    [
      ['circle', { cx: '12', cy: '12', r: '9' }],
      ['path', { d: 'M12 7v5l3 2' }],
    ],
  ],
};

export default function FeatureIcon({ kind }: { kind: string }) {
  const [hovered, setHovered] = useState(false);
  const pair = PAIRS[kind];
  if (!pair) return null;

  return (
    <MorphIcon
      icon={hovered ? pair[1] : pair[0]}
      size={22}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      reducedMotion="user"
      aria-hidden="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    />
  );
}
