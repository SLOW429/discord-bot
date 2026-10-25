const apiOrigin = process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [
      { source: '/auth/:path*', destination: `${apiOrigin}/auth/:path*` },
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
    ];
  },
};

export default nextConfig;
