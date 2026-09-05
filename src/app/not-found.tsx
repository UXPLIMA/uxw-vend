import Link from "next/link";

/**
 * Root not-found page.
 *
 * Reached for a URL that never enters a locale segment, which is also the
 * answer when `app/[locale]/layout.tsx` refuses a segment that is not a locale
 * this site serves.
 *
 * It carries the document itself. Next builds the tree for a 404 out of this
 * file and nothing else - see `createNotFoundLoaderTree` in
 * next/dist/server/app-render/app-render.js, which supplies a page and no
 * layout - so a bare fragment here leaves React with no `<html>` to stream and
 * the response falls back to an empty `__next_error__` shell.
 *
 * Deliberately plain, and styled inline: no locale is resolved this far out,
 * so there are no translations to render with, and no layout of ours has
 * loaded a stylesheet.
 */
export default function NotFound() {
    return (
        <html lang="en">
        <body style={{ margin: 0 }}>
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                textAlign: "center",
                padding: "1rem",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <p style={{ fontSize: "3rem", fontWeight: 800, margin: 0 }}>404</p>
            <h1 style={{ fontSize: "1.25rem", margin: 0 }}>This page does not exist</h1>
            <Link href="/" style={{ color: "#2563eb" }}>Go home</Link>
        </main>
        </body>
        </html>
    );
}
