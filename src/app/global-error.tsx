"use client";

/**
 * The last boundary.
 *
 * `[locale]/layout.tsx` is this app's root layout, and an error boundary never
 * catches its own segment's layout - so when that layout throws (the database
 * is unreachable while it reads settings and messages, say) nothing below it
 * runs and `global-error.tsx` is the only file React will render. Without one,
 * Next serves its stark built-in screen.
 *
 * Deliberately plain, and deliberately self-contained: it replaces the whole
 * document, so it has to supply `<html>` and `<body>` itself, and no locale,
 * theme or message catalogue was resolved before the failure. Styles are
 * inline for the same reason the root not-found page uses them - the
 * stylesheet the layout would have linked is not there.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
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
                    }}
                >
                    <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Something went wrong</h1>
                    <p style={{ color: "#6b7280", margin: 0, maxWidth: "28rem" }}>
                        The site could not be loaded. Please try again in a moment.
                    </p>
                    <button
                        type="button"
                        onClick={() => reset()}
                        style={{
                            marginTop: "0.5rem",
                            padding: "0.5rem 1rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
