'use client';

import { useReducedMotion } from 'framer-motion';
import { useCallback, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

const MAX_PX = 10;

/**
 * Subtle cursor-follow nudge for primary CTAs. Disabled when `prefers-reduced-motion` is set.
 */
export function MagneticButton({
  children,
  className,
  strength = 1,
}: {
  children: ReactElement;
  className?: string;
  /** Multiplier for displacement (default 1). */
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (reduce) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = ((e.clientX - cx) / Math.max(r.width / 2, 1)) * MAX_PX * strength;
      const dy = ((e.clientY - cy) / Math.max(r.height / 2, 1)) * MAX_PX * strength;
      setOff({ x: dx, y: dy });
    },
    [reduce, strength],
  );

  const onLeave = useCallback(() => {
    setOff({ x: 0, y: 0 });
  }, []);

  const style: CSSProperties | undefined =
    reduce || (off.x === 0 && off.y === 0)
      ? undefined
      : { transform: `translate3d(${off.x}px, ${off.y}px, 0)` };

  return (
    <span
      ref={wrapRef}
      className={cn('inline-flex will-change-transform', className)}
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </span>
  );
}
