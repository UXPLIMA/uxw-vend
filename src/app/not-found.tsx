import Link from "next/link";

/**
 * Root not-found page.
 *
 * Reached for a URL that never enters a locale segment. It used to call
 * `notFound()` on itself, which asks the router to render this very page
 * again: the boundary failed on the server and React deferred the whole
 * document to the client, so the response went out as 200 with the 404 body
 * streamed in afterwards.
 *
 * Deliberately plain: no locale is resolved this far out, so there are no
 * translations to render with.
 */
export default function NotFound() {
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
                    <p style={{ fontSize: "3rem", fontWeight: 800, margin: 0 }}>404</p>
                    <h1 style={{ fontSize: "1.25rem", margin: 0 }}>This page does not exist</h1>
                    <Link href="/" style={{ color: "#2563eb" }}>Go home</Link>
                </main>
            </body>
        </html>
    );
}
