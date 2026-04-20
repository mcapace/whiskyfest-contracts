import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WhiskyFest Contracts',
  description: 'Participation contract management — M. Shanken Communications',
  robots: { index: false, follow: false }, // internal tool; no indexing
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Fonts — loaded from Google Fonts for the editorial aesthetic */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
