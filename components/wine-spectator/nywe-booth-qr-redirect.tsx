'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    rbly?: {
      convert?: (
        event: string,
        value?: number,
        currency?: string,
        properties?: Record<string, unknown>,
      ) => void;
      track?: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

const CONVERT_THEN_REDIRECT_MS = 400;
const FAILSAFE_REDIRECT_MS = 2500;

export function NyweBoothQrRedirect({
  apiKey,
  websiteUrl,
  wineryName,
}: {
  apiKey: string | null;
  websiteUrl: string;
  wineryName: string;
}) {
  useEffect(() => {
    const failsafe = window.setTimeout(() => {
      window.location.replace(websiteUrl);
    }, FAILSAFE_REDIRECT_MS);
    if (!apiKey) {
      window.location.replace(websiteUrl);
    }
    return () => window.clearTimeout(failsafe);
  }, [apiKey, websiteUrl]);

  function goToWinery() {
    window.location.replace(websiteUrl);
  }

  function onSdkReady() {
    try {
      window.rbly?.convert?.('nywe_booth_scan');
      window.rbly?.track?.('nywe_booth_scan', {
        source: 'booth_qr',
        winery: wineryName,
      });
    } catch {
      // Still send the guest on.
    }
    window.setTimeout(goToWinery, CONVERT_THEN_REDIRECT_MS);
  }

  return (
    <>
      {apiKey ? (
        <Script
          src="https://cdn.rebrandly.com/analytics/sdk/v1/rbly.min.js"
          strategy="afterInteractive"
          data-api-key={apiKey}
          onReady={onSdkReady}
          onError={goToWinery}
        />
      ) : null}
    </>
  );
}
