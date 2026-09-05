/**
 * Did a write go through, and if it did not, what should the reader be told?
 *
 * The shape all over this codebase is a handler that sends a POST, PATCH or
 * DELETE and then behaves as though it worked:
 *
 *     await fetch("/api/v1/settings", { method: "PATCH", body: ... });
 *     toast.success(t("css_saved"));
 *
 * `fetch` rejects only when the request never reached a server. A 400, a 403
 * on an expired session, a 429 from the rate limiter and a 500 all resolve
 * normally, so that green toast appears for every one of them and the admin
 * walks away believing the change is saved.
 *
 * `writeError` is the one-line check: null when the server accepted the
 * write, otherwise the message to show.
 *
 *     const failed = await writeError(res, t("css_saveFailed"));
 *     if (failed) { toast.error(failed); return; }
 *
 * It returns the caller's message, not the server's. Endpoints answer with an
 * English sentence in `error`; rendering that verbatim is how a Turkish admin
 * ends up reading English on an otherwise Turkish page, which is the same
 * problem `authErrorMessage` exists to solve. A response carrying a `code`
 * the caller's catalogue knows (`err.<code>`) is translated instead, so a
 * rate-limited save can say so rather than falling back to "did not save".
 *
 * The body is consumed on failure only. A caller that wants to read a
 * successful response still can: `writeError` returns before touching it.
 */

import type { Translator } from "./auth-error-message";

export interface WriteErrorBody {
    error?: unknown;
    code?: unknown;
}

export async function writeError(res: Response, fallback: string, t?: Translator): Promise<string | null> {
    if (res.ok) return null;

    let body: WriteErrorBody | null = null;
    try {
        body = (await res.json()) as WriteErrorBody;
    } catch {
        // No body, or not JSON. The status alone is what we have.
    }

    const code = typeof body?.code === "string" ? body.code : null;
    if (t && code) {
        const key = `err.${code}`;
        if (t.has(key)) return t(key);
    }
    return fallback;
}
