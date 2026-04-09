import type { Metadata } from "next";
import { buildPageMeta, buildOrganizationJsonLd } from "@/core/lib/seo";
import { serverConfig } from "@/core/config/server";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import { AppThemeProvider } from "@/core/providers/theme-provider";
import { ModuleProvider } from "@/core/providers/module-provider";
import prisma from "@/core/lib/db";
import { defaultThemeId } from "@/core/generated/theme-registry";
import { CustomCssInjector } from "@/core/components/layout/CustomCssInjector";
import { ModuleLayoutComponents } from "@/core/components/layout/ModuleLayoutComponents";
import { ModuleContextProviders } from "@/core/components/layout/ModuleContextProviders";
import { bootstrapHooks } from "@/core/lib/hooks";
import { bootstrapScheduler } from "@/core/lib/scheduler";
import { registerTrophyListeners } from "@/core/lib/trophy-engine";
import { ensureIndexes as ensureSearchIndexes } from "../../../scripts/ensure-search-indexes";
import { ConfirmProvider } from "@/core/components/ui/confirm-dialog";
import { ProgressBar } from "@/core/components/layout/ProgressBar";
import { MobileBottomNav } from "@/core/components/layout/MobileBottomNav";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/core/components/ErrorBoundary";
import { ImpersonationBanner } from "@/core/components/ImpersonationBanner";
import { Slot } from "@/core/components/Slot";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // Pull site_name/description from Settings via buildPageMeta, then layer
  // root-layout-only fields (title template, manifest) on top.
  const base = await buildPageMeta({
    title: serverConfig.name,
    type: "website",
    url: "/",
  });
  return {
    ...base,
    title: {
      default: serverConfig.name,
      template: `%s | ${serverConfig.name}`,
    },
    keywords: ["open source", "modular platform", "plugin marketplace"],
    manifest: "/manifest.json",
    authors: [{ name: serverConfig.name }],
  };
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  // Initialize module hook listeners (idempotent — runs once per process)
  await bootstrapHooks();
  // Register the DB-driven trophy auto-award engine (idempotent)
  await registerTrophyListeners();
  // Start the cron scheduler (idempotent)
  await bootstrapScheduler();
  // Ensure full-text search GIN indexes exist (fire-and-forget, idempotent)
  ensureSearchIndexes().catch((err: unknown) => {
    console.warn("[search-indexes] bootstrap failed:", err instanceof Error ? err.message : String(err));
  });

  const moduleConfigs = await prisma.moduleConfig.findMany({ select: { id: true, enabled: true } });
  const moduleStates: Record<string, boolean> = {};
  for (const mc of moduleConfigs) { moduleStates[mc.id] = mc.enabled; }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try { if (localStorage.getItem('color-mode') === 'dark') document.documentElement.setAttribute('data-mode', 'dark'); } catch {}
        ` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildOrganizationJsonLd() }}
        />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased bg-background`}
      >
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
              <AppThemeProvider defaultTheme={defaultThemeId}>
                <ModuleProvider moduleStates={moduleStates}>
                <ModuleContextProviders>
                <ConfirmProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10001] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2"
                  >
                    Skip to content
                  </a>
                  <ErrorBoundary>
                  <ImpersonationBanner />
                  <ProgressBar />
                  <CustomCssInjector />
                  <ModuleLayoutComponents />
                  {children}
                  <MobileBottomNav />
                  </ErrorBoundary>
                  <div className="relative z-[9999]">
                    <Slot name="layout.overlay" />
                  </div>
                  <Toaster position="bottom-right" richColors closeButton />
                </ConfirmProvider>
                </ModuleContextProviders>
                </ModuleProvider>
              </AppThemeProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
