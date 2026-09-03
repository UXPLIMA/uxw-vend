/**
 * Test stand-in for `@/core/lib/auth`.
 *
 * `auth.ts` evaluates `NextAuth({...})` at import time, and next-auth's
 * `lib/env.js` does `import "next/server"`. The `next` package publishes no
 * `exports` map, so that specifier is a bare path to Node's ESM resolver and
 * resolves to nothing - fine inside Next's own bundler, fatal anywhere else.
 * Any test that transitively touches auth therefore dies at collection rather
 * than at an assertion.
 *
 * That reach is wider than it looks: `@/core/sdk/server` re-exports
 * `permissions.ts`, which imports `auth`. A module unit test that wants
 * nothing but `prisma` and `log` still pulls the whole NextAuth
 * configuration. `vitest.config.mts` aliases this file in its place.
 *
 * The stub reports "nobody is signed in". A test that needs a session should
 * `vi.mock("@/core/lib/auth")` with the shape it wants; that still wins over
 * the alias.
 */

/** No session. Also usable as the `auth(handler)` wrapper, which returns it unchanged. */
export const auth = (<T>(handler?: T) =>
    handler ?? Promise.resolve(null)) as unknown as {
    (): Promise<null>;
    <T>(handler: T): T;
};

const notRouted = () =>
    new Response("auth handlers are stubbed in tests", { status: 501 });

export const handlers = { GET: notRouted, POST: notRouted };

export const signIn = async () => {
    throw new Error("signIn is stubbed in tests - mock @/core/lib/auth to exercise it");
};

export const signOut = async () => {
    throw new Error("signOut is stubbed in tests - mock @/core/lib/auth to exercise it");
};
