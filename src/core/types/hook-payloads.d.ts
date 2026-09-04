/**
 * The hook payload registry - the typed half of the cross-module contract.
 *
 * A hook is an agreement between two modules that never import each other: the
 * emitter picks a name and a payload shape, the listener has to guess both.
 * These interfaces make the payload half checkable. `doAction` and friends look
 * the name up here; a name that is present must be passed the declared payload,
 * a name that is absent still accepts anything, so nothing is forced to
 * participate.
 *
 * ── Why globals rather than `declare module "@/core/lib/hooks"` ──
 * Interface augmentation has to name the module that DECLARES the interface,
 * and modules are forbidden from importing `@/core/lib/*` - they see core only
 * through `@/core/sdk`, which re-exports and therefore cannot be the
 * augmentation target. A global interface is reachable from any file without an
 * import specifier, which is exactly what a plugin host needs. The `UxwVend`
 * prefix keeps the global type namespace unambiguous.
 *
 * ── How a module joins ──
 * Declare the payload in the module that EMITS the hook (it owns the shape),
 * in any `.ts`/`.d.ts` file inside the module:
 *
 *     declare global {
 *         interface UxwVendHookPayloads {
 *             "store.order.created": { orderNumber: string; total: unknown };
 *         }
 *     }
 *     export {};
 *
 * Consumers then get the payload typed for free - `addAction("store.order.created",
 * (order) => …)` infers `order` - with no import between the two modules. When
 * the emitting module is not installed its declaration is absent, the name is
 * unknown, and the payload falls back to `unknown`: the compile-time story
 * matches the runtime one.
 *
 * Every name declared here must also appear in the emitting module's
 * `hooksEmitted` manifest field, which `npm run validate:module` enforces.
 */

interface UxwVendHookPayloads {
    /** Fired once when the hook system finishes booting. */
    "core.boot": Record<string, never>;

    "user.registered": { userId: string; email: string; username: string };
    "user.login": { userId: string; email: string; ip: string | null; userAgent: string | null };
    "user.email.verified": { userId: string; email: string };
    "user.password.changed": { userId: string };
    "user.profile.updated": { userId: string; changes: Record<string, unknown> };
    "user.warning.issued": {
        warningId: string;
        userId: string;
        issuedById: string;
        reason: string;
        points: number;
        totalPoints: number;
    };
    "user.warning.threshold": { userId: string; points: number; threshold: number };

    "module.installed": { moduleId: string };
    "module.uninstalled": { moduleId: string };
    "module.enabled": { moduleId: string };
    "module.disabled": { moduleId: string };
}

/**
 * The same registry for filters: the value that flows through the chain.
 */
interface UxwVendFilterPayloads {
    "page.title": string;
    "page.meta": Record<string, string>;
    "navbar.links": Array<{ href: string; label: string }>;
    "footer.links": Array<{ href: string; label: string }>;
    "admin.sidebar": Array<{ href: string; label: string; icon?: string }>;
    "email.subject": string;
    "email.body": string;

    /**
     * Whether a login, registration or password reset may proceed. Core runs
     * this before it checks credentials or creates an account; a listener
     * returns `{ ok: false, code }` to refuse. See core/lib/auth-challenge.ts.
     */
    "auth.challenge": { ok: boolean; code: string | null };
}

/**
 * What a filter is asked *about*, as opposed to the value it returns.
 *
 * A filter that asks a question needs both halves typed. `payment.session`
 * carries a result through the chain and an order to pay for alongside it, and
 * a gateway that misreads the second half fails at runtime on a path only two
 * particular modules reach. Declaring the context here types it at the call
 * site and in every listener.
 *
 * Filters with nothing to say about their context simply do not appear, and
 * their context stays `unknown` as before.
 */
interface UxwVendFilterContexts {
    /**
     * What the visitor is trying to do, whatever the `auth.form.challenge`
     * slot asked to be sent, and where the request came from.
     */
    "auth.challenge": {
        action: "login" | "register" | "forgotPassword";
        fields: Record<string, string>;
        ip: string | null;
    };
}
