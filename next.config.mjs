/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/**/*': ['./assets/nywe-gallo-2026-terms.pdf'],
    },
    serverActions: {
      bodySizeLimit: '10mb', // for PDF uploads via Server Actions if needed
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logos.hunter.io', pathname: '/**' },
      { protocol: 'https', hostname: 'img.logo.dev', pathname: '/**' },
    ],
  },
};

export default nextConfig;
