"use client";

import Link from "next/link";
import { useThemeConfig } from "@/core/lib/theme-config-client";
import { ArrowRight } from "lucide-react";

/**
 * Flat theme hero — centered headline, subtitle, single CTA.
 *
 * Off by default. Admins enable it under Theme → Hero and supply copy.
 * When disabled (or no title set) the component renders nothing, so the
 * theme stays clean for sites that don't want a hero.
 */
export default function Hero() {
    const get = useThemeConfig();
    const enabled = get<boolean>("hero.enabled", false);
    if (!enabled) return null;

    const title = get<string>("hero.title", "") ?? "";
    const subtitle = get<string>("hero.subtitle", "") ?? "";
    const ctaText = get<string>("hero.ctaText", "") ?? "";
    const ctaHref = get<string>("hero.ctaHref", "") ?? "";
    const bgImage = get<string>("hero.backgroundImage", "") ?? "";

    if (!title && !subtitle && !ctaText) return null;

    const style: React.CSSProperties = bgImage
        ? {
              backgroundImage: `linear-gradient(rgba(15,23,42,0.65), rgba(15,23,42,0.65)), url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "#ffffff",
          }
        : {
              background:
                  "linear-gradient(135deg, var(--uxw-color-primary) 0%, var(--uxw-color-accent) 100%)",
              color: "#ffffff",
          };

    return (
        <section className="w-full" style={style}>
            <div className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
                {title ? (
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight drop-shadow-sm">
                        {title}
                    </h1>
                ) : null}
                {subtitle ? (
                    <p className="mt-4 text-base md:text-lg opacity-90 max-w-2xl mx-auto">
                        {subtitle}
                    </p>
                ) : null}
                {ctaText && ctaHref ? (
                    <div className="mt-8">
                        <Link
                            href={ctaHref}
                            className="inline-flex items-center gap-2 rounded-md bg-white text-slate-900 px-6 py-2.5 font-medium shadow-sm hover:bg-slate-100 transition-colors"
                        >
                            {ctaText}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
