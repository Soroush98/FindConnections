// next.config.ts
import { NextConfig } from 'next';

const adminSlug = process.env.ADMIN_SLUG;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    if (!adminSlug) return [];
    return [
      { source: `/${adminSlug}`,                destination: '/admin' },
      { source: `/${adminSlug}/:path*`,         destination: '/admin/:path*' },
      { source: `/${adminSlug}-upload`,         destination: '/admin-upload' },
      { source: `/${adminSlug}-upload/:path*`,  destination: '/admin-upload/:path*' },
      { source: `/api/${adminSlug}/login`,      destination: '/api/admin/admin-login' },
    ];
  },
};

module.exports = nextConfig;
