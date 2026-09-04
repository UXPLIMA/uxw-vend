/**
 * Turn an auth API failure into a message in the reader's language.
 *
 * Every auth endpoint used to answer with an English sentence and nothing
 * else, and every screen rendered that sentence verbatim - so a Turkish
 * visitor whose username was taken, whose reset link had expired, or who had
 * simply tried once too often, read the whole thing in English on an
 * otherwise Turkish page. The English string stays on the wire for API
 * clients and logs; it is no longer what a person sees.
 *
 * A response carries a stable `code`; the catalogue carries `auth.err.<code>`
 * in every locale. An unrecognised code falls back to the caller's generic
 * message rather than the server's English, because a code this build does
 * not know about is exactly the case where the English is least likely to
 * mean anything to the reader.
 */

export interface AuthErrorBody {
    error?: unknown;
    code?: unknown;
}

/** The shape both `useTranslations` and `getTranslations` satisfy. */
export interface Translator {
    (key: string): string;
    has(key: string): boolean;
}

export function authErrorMessage(t: Translator, body: AuthErrorBody, fallback: string): string {
    const code = typeof body?.code === "string" ? body.code : null;
    if (code) {
        const key = `err.${code}`;
        if (t.has(key)) return t(key);
    }
    return fallback;
}
