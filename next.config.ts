import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/core/lib/i18n/request.ts');
const analyzeBundles = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const isDev = process.env.NODE_ENV === 'development';

// Hosts allowed to pull Next's dev-only /_next/* resources (client chunks,
// the HMR websocket). Next rejects a bare '*' on purpose - its matcher
// refuses any wildcard that would match a whole host - so an allowlist of
// '*' silently blocks EVERY non-localhost origin with a 403, which reads as
// "the page renders but never hydrates". List real hosts instead, derived
// from the same env URLs src/core/lib/csrf.ts trusts, plus
// NEXT_DEV_ALLOWED_ORIGINS for anything extra (comma-separated hostnames).
function devOriginHosts(): string[] {
  const hosts = new Set<string>();
  for (const raw of [process.env.AUTH_URL, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).hostname);
    } catch {
      // Ignore malformed URLs - the app surfaces those elsewhere.
    }
  }
  for (const part of (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '').split(',')) {
    const host = part.trim();
    if (host) hosts.add(host);
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  // output: "standalone", // Disabled: modules need full node_modules for runtime registry generation
  poweredByHeader: false,
  ...(isDev ? { allowedDevOrigins: devOriginHosts() } : {}),
  serverExternalPackages: ["redis", "net", "fs", "dns", "tls", "pg", "@prisma/adapter-pg", "@aws-sdk/client-s3"],
  images: {
    remotePatterns: [
      // Allow any user-provided image URL (Next.js image optimization is read-only fetch+resize)
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Allow SVG avatars (DiceBear and similar). The optimizer serves them
    // with a strict CSP and Content-Disposition: attachment so an SVG
    // can't execute scripts in the page context if a user supplies a
    // malicious URL.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'none'; script-src 'none'; sandbox;",
    contentDispositionType: "attachment",
  },
  async headers() {
    // Production-grade security header set.
    //
    //  - frame-ancestors 'self' + X-Frame-Options: SAMEORIGIN are required by the
    //    admin theme customizer iframe. Do not loosen.
    //  - style-src keeps 'unsafe-inline' because Tailwind JIT injects CSS via
    //    inline <style> during hydration. Moving to a nonce needs matching
    //    middleware threading and is tracked separately.
    //  - script-src drops 'unsafe-eval' from the *production* policy - Next.js
    //    16 / React 19 no longer need eval() at runtime there. React's
    //    DEVELOPMENT build does eval() (callstack reconstruction across
    //    environments, Turbopack HMR), so dev adds it back or the client
    //    never hydrates. Swagger UI at /admin/api-docs needs it in every
    //    mode, so that route gets its own header override below.
    //  - frame-src lists payment gateway frames (Stripe / PayPal sandbox) so
    //    3DS / checkout iframes render when those modules are installed.

    const buildCsp = (unsafeEval: boolean) => [
      "default-src 'self'",
      // Tailwind JIT + Next.js hydration need inline script/style.
      // static.cloudflareinsights.com hosts the beacon Cloudflare auto-
      // injects when Web Analytics is enabled for the zone; without it
      // the browser logs a CSP violation on every page load.
      `script-src 'self' 'unsafe-inline'${unsafeEval ? " 'unsafe-eval'" : ''} https://static.cloudflareinsights.com`,
      // @measured/puck's CSS pulls Inter from rsms.me (external @import in
      // its bundled stylesheet). Whitelist that origin for both the sheet
      // itself (style-src) and the @font-face URLs it references (font-src).
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://rsms.me",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com https://rsms.me data:",
      // The dev HMR socket is ws:// whenever the app is served over plain
      // HTTP, which wss: alone does not cover.
      `connect-src 'self' https: wss:${isDev ? ' ws:' : ''}`,
      "frame-ancestors 'self'",
      "frame-src 'self' https://api.sandbox.paypal.com https://js.stripe.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ');

    const baseCsp = buildCsp(isDev);

    // /admin/api-docs runs a third-party Swagger UI bundle that still eval()s
    // its own spec loader; we narrow the looser policy to that path instead
    // of applying unsafe-eval to the entire site in production.
    const swaggerCsp = buildCsp(true);

    const commonHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      // Block Flash / Acrobat cross-domain policy file lookups.
      { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      // Spectre / cross-origin process isolation - strong defaults that
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
