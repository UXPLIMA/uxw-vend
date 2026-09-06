import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A refusal reaches the browser with its reason attached.
 *
 * `@auth/core` rethrows an `AuthError` as it is and copies the `code` of a
 * `CredentialsSignin` into the redirect URL. Anything else it wraps in a
 * `CallbackRouteError` whose message stays in the server log, and the browser
 * is handed the wrapper's type name.
 *
 * `authorize` threw plain errors: `new Error("BANNED")`, `"ACCOUNT_LOCKED"`,
 * `"2FA_REQUIRED"` and two more. None of those words ever left the server, so
 * the sign in screen matched on text it could never receive and reported
 * every refusal as a wrong password. A locked account read as a wrong
 * password for the fifteen minutes of its lockout, and an account with a
 * second factor could not sign in at all, because the screen was never told
 * to ask for the code.
 *
 * The mistake is easy to make again, because throwing an error is the obvious
 * thing to do in a callback. This pins the shape rather than the words: what
 * refuses a sign in has to be a `SignInRefusal`, whose code the browser can
 * read with `readRefusal`.
 */

const ROOT = path.resolve(__dirname, "../..");
const AUTH = fs.readFileSync(path.join(ROOT, "src/core/lib/auth.ts"), "utf8");

/** The body of `authorize`, which is the only place a refusal is thrown. */
function authorizeBody(): string {
    const start = AUTH.indexOf("async authorize(");
    expect(start, "authorize() should still be in auth.ts").toBeGreaterThan(-1);
    // Ends where the provider's object literal does, which is the next line
    // at the same indentation that closes the method.
    const end = AUTH.indexOf("\n            },\n", start);
    expect(end, "the end of authorize() should be findable").toBeGreaterThan(start);
    return AUTH.slice(start, end);
}

describe("what refuses a sign in", () => {
    it("throws nothing a browser cannot read the reason from", () => {
        const plain = authorizeBody()
            .split("\n")
            .map((line, i) => ({ line: line.trim(), n: i }))
            .filter(({ line }) => /throw new (?!SignInRefusal)/.test(line));

        expect(
            plain.map(({ line }) => line),
            "a throw inside authorize() is wrapped by @auth/core and its message never reaches the browser, so it must be a SignInRefusal carrying a code from login-refusal.ts",
        ).toEqual([]);
    });

    it("names every reason it refuses for with a code the screen knows", () => {
        const thrown = [...authorizeBody().matchAll(/REFUSAL_CODE\.(\w+)/g)].map((m) => m[1]);
        const known = [...fs
            .readFileSync(path.join(ROOT, "src/core/lib/login-refusal.ts"), "utf8")
            .matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);

        expect(thrown.length, "authorize() should refuse with named codes").toBeGreaterThan(0);
        expect(thrown.filter((c) => !known.includes(c))).toEqual([]);
    });
});
