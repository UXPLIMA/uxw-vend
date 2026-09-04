import { resolveLocaleFromRequest, notFoundStrings } from "@/core/lib/i18n/resolve-locale";
import "../globals.css";

/**
 * The 404 for a `notFound()` thrown anywhere under a locale.
 *
 * It carries its own document, the way the root not-found does, and for the
 * same reason: the site's root layout is `app/[locale]/layout.tsx`, a
 * top-level dynamic segment, and Next has no layout to compose a not-found
 * page out of. Left to itself the boundary failed on the server and React
 * streamed an empty `__next_error__` shell instead - the right 404 status,
 * but no `lang`, no heading and no text, so a crawler, a text browser and a
 * reader with scripting off all got a blank page.
 *
 * It also reads its own strings rather than calling `useTranslations`, which
 * needs the provider that layout mounts, and asks for the locale by cookie
 * and header rather than by a segment it cannot see.
 */
export default async function NotFound() {
    const locale = await resolveLocaleFromRequest();
    const t = await notFoundStrings(locale);

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: `
          try { if (localStorage.getItem('color-mode') === 'dark') document.documentElement.setAttribute('data-mode', 'dark'); } catch {}
        ` }} />
            </head>
            <body className="antialiased bg-background">
                <main className="flex flex-col items-center justify-center min-h-screen px-4">
                    <div className="text-center max-w-md">
                        <div className="text-[120px] font-black text-muted leading-none select-none mb-4" aria-hidden="true">
                            404
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">{t.title}</h1>
                        {t.description && <p className="text-muted-foreground mb-8">{t.description}</p>}
                        <a
                            href={`/${locale}`}
                            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
                        >
                            {t.goHome}
                        </a>
                    </div>
                </main>
            </body>
        </html>
    );
}
