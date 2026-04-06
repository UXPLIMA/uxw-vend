import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/core/lib/i18n/request.ts');
const analyzeBundles = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

// Parse NEXT_PUBLIC_IMAGE_DOMAINS env var for additional allowed image hostnames
const imageHosts = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // output: "standalone", // Disabled: modules need full node_modules for runtime registry generation
  poweredByHeader: false,
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['*'] } : {}),
  serverExternalPackages: ["redis", "net"],
  images: {
    remotePatterns: [
      // Default safe domains
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // User-configured domains via NEXT_PUBLIC_IMAGE_DOMAINS env var
      ...imageHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
