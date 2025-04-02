// next.config.ts
import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
