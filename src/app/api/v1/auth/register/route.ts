import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/core/lib/db";
import { registerSchema } from "@/core/lib/validations";
import { sendWelcomeEmail } from "@/core/lib/email";
import { notifyUserRegistered } from "@/core/lib/discord";
import { logActivity } from "@/core/lib/activity-log";
import { rateLimit, getClientIP, rateLimits } from "@/core/lib/rate-limit";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";

export async function POST(request: NextRequest) {
    // Rate limit: 10 requests per minute per IP
    const ip = getClientIP(request.headers);
    const rl = await rateLimit(`register:${ip}`, rateLimits.auth);
    if (!rl.success) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    try {
        const body = await request.json();

        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const { email, username, password } = validation.data;

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "Email or username already registered" },
                { status: 400 }
            );
        }

        // Get or create default role
        let defaultRole = await prisma.role.findFirst({
            where: { isDefault: true },
        });

        if (!defaultRole) {
            defaultRole = await prisma.role.create({
                data: {
                    name: "member",
                    displayName: "Member",
                    isDefault: true,
                    priority: 0,
                },
            });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                roleId: defaultRole.id,
            },
            select: {
                id: true,
                email: true,
                username: true,
                createdAt: true,
            },
        });

        // Send welcome email and Discord notification (non-blocking)
        sendWelcomeEmail(email, username).catch(console.error);
        notifyUserRegistered({ username, email }).catch(console.error);
        logActivity({ userId: user.id, action: "user.register", entity: "user", entityId: user.id }).catch(console.error);

        return NextResponse.json(
            { message: "User created successfully", user },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Registration error:", error);

        // Handle Prisma unique constraint violations (P2002)
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code: string }).code === "P2002"
        ) {
            return NextResponse.json(
                { error: "Email or username already registered" },
                { status: 400 }
            );
        }

        // Handle Prisma connection / adapter errors
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            typeof (error as { code: string }).code === "string" &&
            (error as { code: string }).code.startsWith("P")
        ) {
            console.error("Prisma error code:", (error as { code: string }).code);
            return NextResponse.json(
                { error: "Database error. Please try again later." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
