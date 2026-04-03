import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "@/core/lib/currency/context";
import { AppThemeProvider } from "@/core/providers/theme-provider";
import { defaultThemeId } from "@/core/generated/theme-registry";
import { CookieConsent } from "@/core/components/layout/CookieConsent";
import { GoogleAnalytics } from "@/core/components/layout/GoogleAnalytics";
import { PopupModal } from "@/core/components/layout/PopupModal";
import { Toaster } from "sonner";
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

export const metadata: Metadata = {
  title: {
    default: "uxwVend - Game Server Platform",
    template: "%s | uxwVend",
  },
  description: "Open source game server management platform with store, forum, blog, and support system.",
  keywords: ["game server", "minecraft", "fivem", "store", "forum", "open source"],
  manifest: "/manifest.json",
  authors: [{ name: "uxwVend" }],
  openGraph: {
    title: "uxwVend - Game Server Platform",
    description: "Open source game server management platform",
    type: "website",
  },
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased bg-background`}
      >
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            <CurrencyProvider>
              <AppThemeProvider defaultTheme={defaultThemeId}>
                <GoogleAnalytics />
                <PopupModal />
                {children}
                <CookieConsent />
                <Toaster position="bottom-right" richColors closeButton />
              </AppThemeProvider>
            </CurrencyProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
