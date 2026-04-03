import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/core/lib/db";
import { registerSchema } from "@/core/lib/validations";
import { sendWelcomeEmail } from "@/core/lib/email";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
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
                { error: existingUser.email === email ? "Email already in use" : "Username already taken" },
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
        const hashedPassword = await bcrypt.hash(password, 12);

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

        // Send welcome email (non-blocking)
        sendWelcomeEmail(email, username).catch(console.error);

        return NextResponse.json(
            { message: "User created successfully", user },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
