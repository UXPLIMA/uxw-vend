import crypto from "crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
    getLockoutStatus,
    registerFailedLogin,
    resetFailedLogins,
} from "./account-lockout";

import type { Provider } from "next-auth/providers";

// Build OAuth providers conditionally — modules set env vars, providers activate
const oauthProviders: Provider[] = [];

// `allowDangerousEmailAccountLinking` defaults to false in NextAuth v5, which
// is the safe choice: if an attacker registers an OAuth identity with the same
// email as an existing credentials account, Auth.js rejects the sign-in with
// OAuthAccountNotLinked. We set it explicitly so a future accidental flip to
// true would be an obvious code review red flag.
if (process.env.AUTH_DISCORD_ID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Discord = require("next-auth/providers/discord").default;
    oauthProviders.push(
        Discord({
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
            allowDangerousEmailAccountLinking: false,
        })
    );
}

if (process.env.AUTH_GOOGLE_ID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Google = require("next-auth/providers/google").default;
    oauthProviders.push(
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: false,
        })
    );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60,
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                twoFactorCode: { label: "2FA Code", type: "text" },
            },
            async authorize(credentials, request) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                    include: { role: true },
                });

                if (!user || !user.password) {
                    return null;
                }

                if (user.isBanned) {
                    throw new Error("BANNED");
                }

                // Account-level lockout check — short-circuits before bcrypt
                // so a locked account can't be brute-forced and can't be
                // used to fingerprint valid emails via response-time delta.
                const lockStatus = getLockoutStatus(user);
                if (lockStatus.locked) {
                    throw new Error("ACCOUNT_LOCKED");
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isPasswordValid) {
                    // Bump the failure counter; when it crosses the
                    // threshold the account is automatically locked for
                    // ACCOUNT_LOCKOUT_MS (default 15m) and the user gets
                    // an early-warning email with the attacker's IP.
                    const reqHeaders = (request as Request | undefined)?.headers;
                    const ip =
                        reqHeaders?.get("x-forwarded-for")?.split(",")[0].trim() ||
                        reqHeaders?.get("x-real-ip") ||
                        undefined;
                    await registerFailedLogin(user.id, { ip });
                    return null;
                }

                // 2FA check — only if fields exist on user (added by two-factor-auth module)
                const userAny = user as Record<string, unknown>;
                if (userAny.twoFactorEnabled && userAny.twoFactorSecret) {
                    // Dynamic import to avoid hard dependency on two-factor module
                    const { verifyToken, verifyBackupCode } = await import("./two-factor");
                    const twoFactorCode = credentials.twoFactorCode as string;

                    if (!twoFactorCode) {
                        throw new Error("2FA_REQUIRED");
                    }

                    // Try TOTP first, then backup code
                    const isValidTotp = verifyToken(userAny.twoFactorSecret as string, twoFactorCode);

                    if (!isValidTotp) {
                        // Try backup code
                        const backupCodes: string[] = userAny.backupCodes ? JSON.parse(userAny.backupCodes as string) : [];
                        const { valid, remaining } = verifyBackupCode(twoFactorCode, backupCodes);

                        if (!valid) {
                            throw new Error("INVALID_2FA");
                        }

                        // Update remaining backup codes
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { backupCodes: JSON.stringify(remaining) } as Record<string, unknown>,
                        });
                    }
                }

                // Clear any residual failed-login counter — this login
                // succeeded, so any lockout from earlier failures (including
                // stale rows from an old attempt) should be reset before the
                // session is minted.
                await resetFailedLogins(user.id);

                // Fire user.login hook — modules can react to successful credential auth.
                // Extract ip + userAgent from the incoming Request (best-effort).
                try {
                    const headers = (request as Request | undefined)?.headers;
                    const ip =
                        headers?.get("x-forwarded-for")?.split(",")[0].trim() ||
                        headers?.get("x-real-ip") ||
                        "";
                    const userAgent = headers?.get("user-agent") || "";
                    const { doActionAsync } = await import("./hooks");
                    await doActionAsync("user.login", {
                        userId: user.id,
                        email: user.email,
                        ip,
                        userAgent,
                    }).catch(() => {});
                } catch { /* non-fatal */ }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.username,
                    image: user.avatar,
                    role: user.role?.name || "member",
                    rolePriority: user.role?.priority ?? 0,
                };
            },
        }),
        ...oauthProviders,
    ],
    events: {
        async createUser({ user }) {
            // Assign default "member" role to OAuth users on first sign-up
            const defaultRole = await prisma.role.findFirst({
                where: { name: "member" },
            });
            if (defaultRole && user.id) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { roleId: defaultRole.id },
                });
            }
            // Fire user.registered action for modules to react to
            const { doActionAsync, HookNames } = await import("./hooks");
            await doActionAsync(HookNames.USER_REGISTERED, {
                userId: user.id!,
                email: user.email || "",
                username: user.name || "",
            });
        },
        async signIn({ user }) {
            const { doActionAsync, HookNames } = await import("./hooks");
            await doActionAsync(HookNames.USER_LOGGED_IN, {
                userId: user.id!,
                email: user.email || "",
            });
        },
        async signOut() {
            const { doActionAsync, HookNames } = await import("./hooks");
            await doActionAsync(HookNames.USER_LOGGED_OUT, {});
        },
    },
    callbacks: {
        // Reject OAuth and credential sign-ins at the handshake if the user
        // is banned, so we never mint a session (even a short-lived one) for
        // a banned account. The jwt callback below revokes active sessions
        // on their next refresh as a second line of defense.
        async signIn({ user }) {
            if (!user?.id) return true;
            const existing = await prisma.user.findUnique({
                where: { id: user.id },
                select: { isBanned: true, isDeleted: true },
            });
            if (existing?.isBanned || existing?.isDeleted) return false;
            return true;
        },
        async jwt({ token, user, trigger, session: updatePayload }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role?: string }).role;
                token.rolePriority = (user as { rolePriority?: number }).rolePriority ?? 0;
                // Generate a stable per-login token id for session tracking
                token.tokenId = crypto.randomUUID();
            }

            // ─── Impersonation: start ───
            // Triggered by client calling update({ impersonate: userId }).
            // Only the CURRENT token (pre-swap) may be admin, and it cannot
            // stack another impersonation on top of an existing one.
            if (
                trigger === "update" &&
                updatePayload &&
                typeof updatePayload === "object" &&
                "impersonate" in updatePayload &&
                typeof (updatePayload as { impersonate?: unknown }).impersonate === "string"
            ) {
                const targetUserId = (updatePayload as { impersonate: string }).impersonate;
                const currentRole = token.role as string | undefined;
                if (currentRole !== "admin") return token;
                if (token.originalUserId) return token;
                const target = await prisma.user.findUnique({
                    where: { id: targetUserId },
                    include: { role: true },
                });
                if (!target) return token;
                token.originalUserId = token.id;
                token.id = target.id;
                token.role = target.role?.name || "member";
                token.rolePriority = target.role?.priority ?? 0;
                return token;
            }

            // ─── Impersonation: stop ───
            // Restores the original admin identity on the token.
            if (
                trigger === "update" &&
                updatePayload &&
                typeof updatePayload === "object" &&
                "stopImpersonating" in updatePayload &&
                (updatePayload as { stopImpersonating?: unknown }).stopImpersonating === true
            ) {
                const original = token.originalUserId as string | undefined;
                if (!original) return token;
                const admin = await prisma.user.findUnique({
                    where: { id: original },
                    include: { role: true },
                });
                if (!admin) return token;
                token.id = admin.id;
                token.role = admin.role?.name || "member";
                token.rolePriority = admin.role?.priority ?? 0;
                token.originalUserId = undefined;
                return token;
            }

            // Refresh role + ban status from DB on every token refresh.
            //
            // When impersonating, we check the impersonated user (token.id) —
            // if they become banned/deleted the impersonation session ends
            // immediately, not at the next manual update(). When not
            // impersonating, this also refreshes the admin's own role so a
            // demotion takes effect on the next request.
            if (trigger === "update" || !token.role || token.rolePriority === undefined) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    include: { role: true },
                });
                if (dbUser) {
                    if (dbUser.isBanned || dbUser.isDeleted) {
                        return null as unknown as typeof token;
                    }
                    if (token.tokenId) {
                        const sess = await prisma.userSession.findUnique({
                            where: { tokenId: token.tokenId as string },
                        });
                        if (sess?.isRevoked) {
                            return null as unknown as typeof token;
                        }
                    }
                    token.role = dbUser.role?.name || "member";
                    token.rolePriority = dbUser.role?.priority ?? 0;
                }

                // Double-check the original admin identity during impersonation
                // — if the admin has been banned / demoted since starting the
                // impersonation, we must NOT let them keep acting as someone else.
                if (token.originalUserId) {
                    const realAdmin = await prisma.user.findUnique({
                        where: { id: token.originalUserId as string },
                        select: { isBanned: true, isDeleted: true, role: { select: { name: true } } },
                    });
                    if (!realAdmin || realAdmin.isBanned || realAdmin.isDeleted || realAdmin.role?.name !== "admin") {
                        return null as unknown as typeof token;
                    }
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.rolePriority = (token.rolePriority as number) ?? 0;
                session.user.originalUserId = (token.originalUserId as string | undefined) ?? undefined;
            }
            return session;
        },
    },
});

// Type extensions for NextAuth
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            image?: string;
            role: string;
            rolePriority: number;
            /**
             * When set, this session is an admin impersonating another user.
             * The value is the admin's real user id. `session.user.id` reflects
             * the impersonated target while this field is populated.
             */
            originalUserId?: string;
        };
    }

    interface User {
        role?: string;
        rolePriority?: number;
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        id?: string;
        role?: string;
        rolePriority?: number;
        tokenId?: string;
        /** Set while impersonating — holds the real admin's user id. */
        originalUserId?: string;
    }
}
