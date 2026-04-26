'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';

const PRIMARY = '/images/whiskyfest-login-hero.jpg';
const FALLBACK = '/images/whiskyfest-hero.jpg';

/**
 * Full-bleed hero with graceful fallback if the primary asset is missing.
 */
export function LoginHero() {
  const [src, setSrc] = useState(PRIMARY);

  const onError = useCallback(() => {
    setSrc((current) => (current === PRIMARY ? FALLBACK : current));
  }, []);

  return (
    <Image
      src={src}
      alt=""
      fill
      className="object-cover object-center"
      priority
      onError={onError}
    />
  );
}
