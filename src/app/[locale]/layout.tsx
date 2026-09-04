import type { Metadata } from "next";
import { buildPageMeta, buildOrganizationJsonLd } from "@/core/lib/seo";
import { serverConfig } from "@/core/config/server";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { publicMessages } from "@/core/lib/i18n/message-scopes";
import { SessionProvider } from "next-auth/react";
import { AppThemeProvider } from "@/core/providers/theme-provider";
import { ModuleProvider } from "@/core/providers/module-provider";
import { getModuleStates } from "@/core/lib/module-cache";
import { getActiveTheme } from "@/core/lib/theme-state";
import { CustomCssInjector } from "@/core/components/layout/CustomCssInjector";
import { ModuleLayoutComponents } from "@/core/components/layout/ModuleLayoutComponents";
import { ServerSlot } from "@/core/components/ServerSlot";
import { ModuleContextProviders } from "@/core/components/layout/ModuleContextProviders";
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
  // Pull site_name/description from Settings, then layer root-layout-only
  // fields (title template, manifest) on top.
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
  const commonT = await getTranslations("common");

  // Process-wide bootstrap (hooks, scheduler, search indexes) lives in
  // src/instrumentation.ts. A layout render is a per-request event and was
  // never the right trigger for it.

  // Through the shared cache, not a raw findMany: this runs on every page
  // render, and the uncached version both re-queried per request and threw
  // the whole layout away on a database blip instead of failing soft.
  const moduleStates = await getModuleStates();

  // Resolve active theme + merged config on the server so the first paint
  // matches user customizations without a client round-trip.
  const active = await getActiveTheme();

  // Build an override <style> block so admin-saved color customizations
  // actually take effect. The generated theme-tokens.css sets
  // [data-theme][data-mode] { --uxw-color-X: ... } with the manifest
  // defaults; we append a same-specificity block with the admin's overrides
  // so the later declaration wins the cascade. Values reach here only after
  // HEX-only sanitization in the customization API - safe to interpolate.
  const overrideColors = ((active.tokenOverrides as { tokens?: { colors?: Record<string, string> } })?.tokens?.colors) ?? {};
  const overrideEntries = Object.entries(overrideColors).filter(
    ([, v]) => typeof v === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v),
  );
  const overrideCss = overrideEntries.length > 0
    ? `[data-theme="${active.themeId}"][data-mode="${active.mode}"] {\n${overrideEntries.map(([k, v]) => `  --uxw-color-${k}: ${v};`).join("\n")}\n}`
    : "";

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
        {overrideCss && <style dangerouslySetInnerHTML={{ __html: overrideCss }} />}
        <ServerSlot name="head.extra" moduleStates={moduleStates} />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased bg-background`}
      >
        <SessionProvider>
          <NextIntlClientProvider messages={publicMessages(messages)}>
              <AppThemeProvider themeId={active.themeId} mode={active.mode} serverConfig={active.settings}>
                <ModuleProvider moduleStates={moduleStates}>
                <ModuleContextProviders>
                <ConfirmProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10001] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2"
                  >
                    {commonT("skipToContent")}
                  </a>
                  <ErrorBoundary>
                  <ImpersonationBanner />
                  <ProgressBar />
                  <CustomCssInjector />
                  <ModuleLayoutComponents />
                  <Slot name="layout.top" />
                  <Slot name="layout.beforeMain" />
                  {children}
                  <Slot name="layout.afterMain" />
                  <MobileBottomNav />
                  </ErrorBoundary>
                  <div className="relative z-[9999]">
                    <Slot name="layout.overlay" />
                  </div>
                  {/* sonner names its own live region, and its default is English. */}
                  <Toaster
                    position="bottom-right"
                    richColors
                    closeButton
                    containerAriaLabel={commonT("notifications")}
                  />
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
