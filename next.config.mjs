/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // for PDF uploads via Server Actions if needed
    },
  },
};

export default nextConfig;
