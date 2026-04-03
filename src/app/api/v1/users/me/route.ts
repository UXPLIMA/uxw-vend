import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { updateUserSchema } from "@/core/lib/validations";

// GET /api/v1/users/me - Get current user
export async function GET() {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                email: true,
                username: true,
                avatar: true,
                emailVerified: true,
                createdAt: true,
                role: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        color: true,
                        permissions: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error("Get current user error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH /api/v1/users/me - Update current user
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validation = updateUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const { username, avatar } = validation.data;

        // Check if username is taken
        if (username) {
            const existing = await prisma.user.findFirst({
                where: {
                    username,
                    NOT: { id: session.user.id },
                },
            });

            if (existing) {
                return NextResponse.json(
                    { error: "Username already taken" },
                    { status: 400 }
                );
            }
        }

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                ...(username && { username }),
                ...(avatar !== undefined && { avatar }),
            },
            select: {
                id: true,
                email: true,
                username: true,
                avatar: true,
            },
        });

        return NextResponse.json({ user });
    } catch (error) {
        console.error("Update user error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
