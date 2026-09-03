/**
 * Resolves the OAuth providers contributed by installed modules.
 *
 * Core ships no OAuth provider of its own. Each module declares one in its
 * manifest (`authProviders`), the registry generator collects those
 * declarations into `ModuleAuthProviders`, and this resolver turns them into
 * Auth.js provider instances.
 *
 * The factory map is emitted with static imports so the bundler resolves
 * exactly the providers installed modules asked for; a runtime
 * `require(`next-auth/providers/${id}`)` would instead drag in every provider
 * next-auth ships, including ones with optional native dependencies.
 *
 * Activation stays env-gated rather than reading `ModuleConfig.enabled`:
 * Auth.js builds its configuration synchronously at module load, long before a
 * database round-trip is possible. A module that is installed but has no
 * credentials configured therefore contributes nothing, which is the same
 * behaviour as before this became registry-driven.
 */

/**
 * Deliberately not typed as Auth.js's `Provider`: importing that type pulls the
 * `next-auth/providers` barrel into the middleware bundle, which re-exports
 * `@auth/core/providers` and fails to resolve. `auth.ts` narrows the result.
 */
export type ResolvedProvider = unknown;

export interface DeclaredAuthProvider {
    /** Auth.js provider id - resolved as `next-auth/providers/<id>`. */
    id: string;
    /** Env var holding the OAuth client id. */
    envIdVar: string;
    /** Env var holding the OAuth client secret. */
    envSecretVar: string;
    /** Module that declared this provider, for diagnostics. */
    module: string;
}

interface ProviderConfig {
    clientId: string;
    clientSecret: string;
    allowDangerousEmailAccountLinking: boolean;
}

/** Loosely typed to match the generated registry, which cannot import Auth.js types. */
export type ProviderFactory = (config: ProviderConfig) => unknown;

export interface ResolveAuthProvidersOptions {
    /** Statically imported provider constructors, keyed by Auth.js provider id. */
    factories: Record<string, ProviderFactory | undefined>;
    env?: Record<string, string | undefined>;
    onWarn?: (message: string) => void;
}

export function resolveAuthProviders(
    declarations: readonly DeclaredAuthProvider[],
    options: ResolveAuthProvidersOptions,
): ResolvedProvider[] {
    const { factories, env = process.env, onWarn = (message: string) => console.warn(message) } = options;

    const providers: ResolvedProvider[] = [];

    for (const declared of declarations) {
        const clientId = env[declared.envIdVar];
        const clientSecret = env[declared.envSecretVar];
        // Not configured on this install: stay silent, this is the normal
        // state for a module whose credentials the admin has not filled in.
        if (!clientId || !clientSecret) continue;

        const factory = factories[declared.id];
        if (typeof factory !== "function") {
            onWarn(
                `[auth] Module "${declared.module}" declared auth provider "${declared.id}", ` +
                    `but next-auth ships no such provider - skipped.`,
            );
            continue;
        }

        try {
            providers.push(
                factory({
                    clientId,
                    clientSecret,
                    // Defaults to false in Auth.js v5, which is the safe choice: if an
                    // attacker registers an OAuth identity with the same email as an
                    // existing credentials account, Auth.js rejects the sign-in with
                    // OAuthAccountNotLinked. Spelled out so a future accidental flip to
                    // true is an obvious code review red flag.
                    allowDangerousEmailAccountLinking: false,
                }),
            );
        } catch (error) {
            onWarn(
                `[auth] Module "${declared.module}" failed to build auth provider "${declared.id}": ` +
                    `${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    return providers;
}
