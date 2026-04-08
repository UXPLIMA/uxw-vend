import crypto from "crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

import type { Provider } from "next-auth/providers";

// Build OAuth providers conditionally — modules set env vars, providers activate
const oauthProviders: Provider[] = [];

if (process.env.AUTH_DISCORD_ID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Discord = require("next-auth/providers/discord").default;
    oauthProviders.push(
        Discord({
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
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

                const isPasswordValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isPasswordValid) {
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
        async jwt({ token, user, trigger }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role?: string }).role;
                token.rolePriority = (user as { rolePriority?: number }).rolePriority ?? 0;
                // Generate a stable per-login token id for session tracking
                token.tokenId = crypto.randomUUID();
            }
            // Refresh role + ban status from DB on every token refresh
            if (trigger === "update" || !token.role || token.rolePriority === undefined) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    include: { role: true },
                });
                if (dbUser) {
                    // Invalidate session if user is banned
                    if (dbUser.isBanned) {
                        return null as unknown as typeof token;
                    }
                    // Invalidate if this session has been revoked
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
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.rolePriority = (token.rolePriority as number) ?? 0;
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
        };
    }

    interface User {
        role?: string;
        rolePriority?: number;
    }
}
