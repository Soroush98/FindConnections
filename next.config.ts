// next.config.ts
import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
      // Add additional patterns as needed, for example:
      // {
      //   protocol: 'https',
      //   hostname: 'images.example.com',
      //   pathname: '/photos/**',
      // },
    ],
    // If you prefer to just list domains without path restrictions:
    // domains: [
    //   'your-bucket-name.s3.amazonaws.com',
    //   'images.example.com'
    // ],
  },
};

module.exports = nextConfig;
