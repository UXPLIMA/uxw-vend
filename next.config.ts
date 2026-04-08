import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/core/lib/i18n/request.ts');
const analyzeBundles = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  // output: "standalone", // Disabled: modules need full node_modules for runtime registry generation
  poweredByHeader: false,
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['*'] } : {}),
  serverExternalPackages: ["redis", "net", "fs", "dns", "tls", "pg", "@prisma/adapter-pg", "@aws-sdk/client-s3"],
  images: {
    remotePatterns: [
      // Allow any user-provided image URL (Next.js image optimization is read-only fetch+resize)
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async headers() {
    // Production-grade security header set. Applied to every route.
    // Notes:
    //  - frame-ancestors 'self' + X-Frame-Options: SAMEORIGIN are required by the
    //    admin theme customizer iframe (Phase 9). Do not loosen.
    //  - CSP keeps 'unsafe-inline' for style-src (Tailwind JIT + CSS variables)
    //    and 'unsafe-inline' + 'unsafe-eval' for script-src because Next.js
    //    runtime + Swagger UI at /admin/api-docs need both. Revisit when we can
    //    migrate Swagger UI to a pre-bundled static variant.
    //  - frame-src lists payment gateway frames (Stripe/PayPal sandbox) so their
    //    3DS/checkout iframes can render when those modules are installed.
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          // Next.js runtime + Swagger UI (/admin/api-docs) need unsafe-eval; review later
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          // Tailwind JIT needs unsafe-inline
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' https://fonts.gstatic.com data:",
          "connect-src 'self' https: wss:",
          "frame-ancestors 'self'",
          "frame-src 'self' https://api.sandbox.paypal.com https://js.stripe.com",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; ') },
      ]
    }];
  },
};

export default analyzeBundles(withNextIntl(nextConfig));
