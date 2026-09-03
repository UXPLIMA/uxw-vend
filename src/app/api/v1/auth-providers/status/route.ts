/**
 * Whether each module-contributed sign-in provider is actually configured.
 *
 * Modules declare a provider and the env vars that switch it on, and the
 * provider silently contributes nothing until those are set. Silently is the
 * problem: an admin installs a login module, sees no button, and has no way to
 * find out why. This endpoint is that way.
 *
 * Values are never returned - only whether each variable is set - and the
 * whole thing is admin-only regardless.
 */
import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { resolveAppUrl } from "@/core/lib/app-url";
import { ModuleAuthProviders } from "@/core/generated/module-auth-providers";

export interface AuthProviderStatus {
    id: string;
    module: string;
    /** Every env var this provider needs, in the order the manifest named them. */
    envVars: string[];
    /** The subset that is missing. Empty means the provider is live. */
    missing: string[];
    configured: boolean;
    /**
     * The redirect URL to register with the provider. A provider Auth.js ships
     * always has one; a module-supplied provider has one only if it said so
     * with `standardCallback`, because a module that runs its own flow decides
     * where that flow returns to and documents it itself.
     */
    callbackUrl: string | null;
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const appUrl = resolveAppUrl();
    const providers: AuthProviderStatus[] = ModuleAuthProviders.map((declared) => {
        const envVars = declared.factory
            ? (declared.envVars ?? [])
            : [declared.envIdVar, declared.envSecretVar].filter((v): v is string => Boolean(v));
        const missing = envVars.filter((name) => !process.env[name]);
        return {
            id: declared.id,
            module: declared.module,
            envVars,
            missing,
            configured: envVars.length > 0 && missing.length === 0,
            callbackUrl:
                !declared.factory || declared.standardCallback
                    ? `${appUrl}/api/auth/callback/${declared.id}`
                    : null,
        };
    });

    return NextResponse.json({ providers });
}
