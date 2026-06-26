import '@/lib/polyfills/url-parse';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter, JetBrains_Mono, Spectral } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { portalMetadataForHost } from '@/lib/portal-metadata';
import { ThemeRoot } from '@/components/theme/theme-root';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host');
  return {
    ...portalMetadataForHost(host),
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`h-full ${inter.variable} ${spectral.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <SessionProvider session={session}>
          <ThemeRoot />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
