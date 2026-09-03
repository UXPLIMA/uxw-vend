/**
 * Resolves the identity providers contributed by installed modules.
 *
 * Core ships no OAuth provider of its own. Each module declares one in its
 * manifest (`authProviders`), the registry generator collects those
 * declarations into `ModuleAuthProviders`, and this resolver turns them into
 * Auth.js provider instances.
 *
 * A declaration comes in one of two shapes:
 *
 * - **Built in** - `envIdVar` + `envSecretVar`. The id resolves as
 *   `next-auth/providers/<id>` and the provider gets a client id and secret.
 * - **Module supplied** - `factory` + `envVars`. The module built the provider
 *   itself, which is the only way to reach an identity system Auth.js does not
 *   ship, and receives the env vars it asked for.
 *
 * Both factory maps are emitted with static imports so the bundler resolves
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
    /** Provider id - the slug `signIn()` is called with. */
    id: string;
    /** Env var holding the OAuth client id. Built-in providers only. */
    envIdVar?: string;
    /** Env var holding the OAuth client secret. Built-in providers only. */
    envSecretVar?: string;
    /** Module-relative path the generator imported the factory from. Module-supplied only. */
    factory?: string;
    /** Env vars a module-supplied provider needs, all of which must be set. */
    envVars?: string[];
    /** Module that declared this provider, for diagnostics. */
    module: string;
}

/**
 * Defaults to false in Auth.js v5, which is the safe choice: if an attacker
 * registers an identity with the same email as an existing credentials
 * account, Auth.js rejects the sign-in with OAuthAccountNotLinked. Spelled out
 * at both call sites below so a future accidental flip to true is an obvious
 * code review red flag.
 */
const ALLOW_DANGEROUS_EMAIL_ACCOUNT_LINKING = false;

interface BuiltInProviderConfig {
    clientId: string;
    clientSecret: string;
    allowDangerousEmailAccountLinking: boolean;
}

interface ModuleProviderConfig {
    /** Exactly the env vars the manifest declared, each one present and non-empty. */
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

/** Loosely typed to match the generated registry, which cannot import Auth.js types. */
export type ProviderFactory = (config: BuiltInProviderConfig) => unknown;
export type ModuleProviderFactory = (config: ModuleProviderConfig) => unknown;

export interface ResolveAuthProvidersOptions {
    /** Statically imported Auth.js provider constructors, keyed by provider id. */
    factories: Record<string, ProviderFactory | undefined>;
    /** Statically imported module-supplied provider builders, keyed by provider id. */
    moduleFactories?: Record<string, ModuleProviderFactory | undefined>;
    env?: Record<string, string | undefined>;
    onWarn?: (message: string) => void;
}

export function resolveAuthProviders(
    declarations: readonly DeclaredAuthProvider[],
    options: ResolveAuthProvidersOptions,
): ResolvedProvider[] {
    const {
        factories,
        moduleFactories = {},
        env = process.env,
        onWarn = (message: string) => console.warn(message),
    } = options;

    const providers: ResolvedProvider[] = [];

    const build = (declared: DeclaredAuthProvider, make: () => unknown) => {
        try {
            providers.push(make());
        } catch (error) {
            onWarn(
                `[auth] Module "${declared.module}" failed to build auth provider "${declared.id}": ` +
                    `${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };

    for (const declared of declarations) {
        if (declared.factory) {
            const names = declared.envVars ?? [];
            const values: Record<string, string> = {};
            let configured = names.length > 0;
            for (const name of names) {
                const value = env[name];
                // Not configured on this install: stay silent, this is the
                // normal state for a module whose credentials the admin has
                // not filled in.
                if (!value) {
                    configured = false;
                    break;
                }
                values[name] = value;
            }
            if (!configured) continue;

            const factory = moduleFactories[declared.id];
            if (typeof factory !== "function") {
                onWarn(
                    `[auth] Module "${declared.module}" declared auth provider "${declared.id}" with a ` +
                        `factory, but the registry has no builder for it - skipped.`,
                );
                continue;
            }
            build(declared, () =>
                factory({
                    env: values,
                    allowDangerousEmailAccountLinking: ALLOW_DANGEROUS_EMAIL_ACCOUNT_LINKING,
                }),
            );
            continue;
        }

        const clientId = declared.envIdVar ? env[declared.envIdVar] : undefined;
        const clientSecret = declared.envSecretVar ? env[declared.envSecretVar] : undefined;
        if (!clientId || !clientSecret) continue;

        const factory = factories[declared.id];
        if (typeof factory !== "function") {
            onWarn(
                `[auth] Module "${declared.module}" declared auth provider "${declared.id}", ` +
                    `but next-auth ships no such provider - skipped.`,
            );
            continue;
        }
        build(declared, () =>
            factory({
                clientId,
                clientSecret,
                allowDangerousEmailAccountLinking: ALLOW_DANGEROUS_EMAIL_ACCOUNT_LINKING,
            }),
        );
    }

    return providers;
}
