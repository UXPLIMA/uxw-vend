import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { verifyToken, verifyBackupCode } from "./two-factor";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
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
            async authorize(credentials) {
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

                // 2FA check
                if (user.twoFactorEnabled && user.twoFactorSecret) {
                    const twoFactorCode = credentials.twoFactorCode as string;

                    if (!twoFactorCode) {
                        throw new Error("2FA_REQUIRED");
                    }

                    // Try TOTP first, then backup code
                    const isValidTotp = verifyToken(user.twoFactorSecret, twoFactorCode);

                    if (!isValidTotp) {
                        // Try backup code
                        const backupCodes: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : [];
                        const { valid, remaining } = verifyBackupCode(twoFactorCode, backupCodes);

                        if (!valid) {
                            throw new Error("INVALID_2FA");
                        }

                        // Update remaining backup codes
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { backupCodes: JSON.stringify(remaining) },
                        });
                    }
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.username,
                    image: user.avatar,
                    role: user.role?.name || "member",
                };
            },
        }),
        Discord({
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
        }),
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
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
        },
    },
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role?: string }).role;
            }
            // Refresh role + ban status from DB on every token refresh
            if (trigger === "update" || !token.role) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    include: { role: true },
                });
                if (dbUser) {
                    // Invalidate session if user is banned
                    if (dbUser.isBanned) {
                        return null as unknown as typeof token;
                    }
                    token.role = dbUser.role?.name || "member";
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
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
        };
    }

    interface User {
        role?: string;
    }
}

