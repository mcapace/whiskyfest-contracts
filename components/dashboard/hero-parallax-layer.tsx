'use client';

import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Hero background with light scroll-based parallax. No-op when reduced motion is preferred.
 */
export function HeroParallaxLayer({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [shiftY, setShiftY] = useState(0);

  const update = useCallback(() => {
    if (reduce) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const t = Math.min(Math.max((vh - rect.top) / (vh + rect.height), 0), 1);
    setShiftY((t - 0.5) * 28);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [reduce, update]);

  return (
    <div ref={rootRef} className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      <Image
        src="/images/AdobeStock_271973922.jpeg"
        alt=""
        fill
        className={cn(
          'object-cover object-[center_38%] opacity-60 sm:object-[center_35%]',
          imageClassName,
        )}
        style={
          reduce
            ? undefined
            : {
                transform: `translate3d(0, ${shiftY}px, 0) scale(1.07)`,
                transition: 'transform 0.12s ease-out',
              }
        }
        priority
      />
    </div>
  );
}
