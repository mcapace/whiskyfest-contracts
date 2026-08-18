import type { Metadata } from 'next';
import { NYWE_EVENT_NAME } from '@/lib/nywe-copy';
import {
  loadNyweBoothQrRedirect,
  rebrandlyConversionApiKey,
} from '@/lib/nywe-booth-qr';
import { NyweBoothQrRedirect } from '@/components/wine-spectator/nywe-booth-qr-redirect';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: NYWE_EVENT_NAME,
  robots: { index: false, follow: false },
};

export default async function NyweBoothQrLandingPage({ params }: { params: { id: string } }) {
  const payload = await loadNyweBoothQrRedirect(params.id);

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
        <p className="text-sm font-medium text-muted-foreground">{NYWE_EVENT_NAME}</p>
        <h1 className="mt-2 text-xl font-semibold">This booth link is not available</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The winery website for this booth has not been set yet. Please ask at the booth for the
          winery&apos;s site.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
      <p className="text-sm font-medium text-muted-foreground">{NYWE_EVENT_NAME}</p>
      <h1 className="mt-2 text-xl font-semibold">Taking you to {payload.wineryName}</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        One moment while we open the winery website.
      </p>
      <p className="mt-6 text-sm">
        <a className="underline underline-offset-2" href={payload.websiteUrl}>
          Continue if you are not redirected
        </a>
      </p>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${payload.websiteUrl}`} />
      </noscript>
      <NyweBoothQrRedirect
        apiKey={rebrandlyConversionApiKey()}
        websiteUrl={payload.websiteUrl}
        wineryName={payload.wineryName}
      />
    </main>
  );
}
