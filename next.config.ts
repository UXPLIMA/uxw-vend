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
    // Production-grade security header set.
    //
    //  - frame-ancestors 'self' + X-Frame-Options: SAMEORIGIN are required by the
    //    admin theme customizer iframe. Do not loosen.
    //  - style-src keeps 'unsafe-inline' because Tailwind JIT injects CSS via
    //    inline <style> during hydration. Moving to a nonce needs matching
    //    middleware threading and is tracked separately.
    //  - script-src drops 'unsafe-eval' from the global policy — Next.js 16 /
    //    React 19 no longer need eval() at runtime. Swagger UI at
    //    /admin/api-docs DOES need it, so that route gets its own header
    //    override below.
    //  - frame-src lists payment gateway frames (Stripe / PayPal sandbox) so
    //    3DS / checkout iframes render when those modules are installed.

    const baseCsp = [
      "default-src 'self'",
      // Tailwind JIT + Next.js hydration need inline script/style for now.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self'",
      "frame-src 'self' https://api.sandbox.paypal.com https://js.stripe.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ');

    // /admin/api-docs runs a third-party Swagger UI bundle that still eval()s
    // its own spec loader; we narrow the looser policy to that path instead
    // of applying unsafe-eval to the entire site.
    const swaggerCsp = baseCsp.replace(
      "script-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );

    const commonHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      // Block Flash / Acrobat cross-domain policy file lookups.
      { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      // Spectre / cross-origin process isolation — strong defaults that
      // don't break current pages. Revisit if modules embed third-party
      // widgets that need postMessage access across origins.
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    ];

    return [
      {
        source: '/:locale/admin/api-docs/:path*',
        headers: [
          ...commonHeaders,
          { key: 'Content-Security-Policy', value: swaggerCsp },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          ...commonHeaders,
          { key: 'Content-Security-Policy', value: baseCsp },
        ],
      },
    ];
  },
};

export default analyzeBundles(withNextIntl(nextConfig));
