import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/core/lib/i18n/request.ts');
const analyzeBundles = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  // output: "standalone", // Disabled: modules need full node_modules for runtime registry generation
  poweredByHeader: false,
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['*'] } : {}),
  serverExternalPackages: ["redis", "net", "fs", "dns", "tls", "pg", "@prisma/adapter-pg"],
  images: {
    remotePatterns: [
      // Allow any user-provided image URL (Next.js image optimization is read-only fetch+resize)
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' https:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ') },
      ]
    }];
  },
};

export default analyzeBundles(withNextIntl(nextConfig));
