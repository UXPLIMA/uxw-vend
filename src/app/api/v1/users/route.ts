import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { PER_PAGE_USERS, BCRYPT_ROUNDS, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from "@/core/lib/constants";
import bcrypt from "bcryptjs";

// GET /api/v1/users - List users (admin only)
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || String(PER_PAGE_USERS)) || 20));
        const search = searchParams.get("search") || "";

        const where = search
            ? {
                OR: [
                    { username: { contains: search, mode: "insensitive" as const } },
                    { email: { contains: search, mode: "insensitive" as const } },
                ],
            }
            : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    avatar: true,
                    createdAt: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            displayName: true,
                            color: true,
                        },
                    },
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.user.count({ where }),
        ]);

        return NextResponse.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("List users error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// POST /api/v1/users - Create user (admin only)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { email, username, password, roleId } = body;

        if (!email || !username || !password) {
            return NextResponse.json(
                { error: "Email, username, and password are required" },
                { status: 400 }
            );
        }

        if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
            return NextResponse.json(
                { error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters` },
                { status: 400 }
            );
        }

        if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
            return NextResponse.json(
                { error: `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters` },
                { status: 400 }
            );
        }

        // Check for existing user
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email.toLowerCase() },
                    { username: { equals: username, mode: "insensitive" } },
                ],
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: existing.email === email.toLowerCase() ? "Email already in use" : "Username already taken" },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Use provided roleId or fall back to default "user" role
        let assignRoleId = roleId;
        if (!assignRoleId) {
            const userRole = await prisma.role.findFirst({ where: { name: "user" } });
            assignRoleId = userRole?.id;
        }

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                username,
                password: hashedPassword,
                emailVerified: new Date(), // Admin-created users are auto-verified
                ...(assignRoleId ? { roleId: assignRoleId } : {}),
            },
            select: {
                id: true,
                email: true,
                username: true,
                createdAt: true,
                role: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        color: true,
                    },
                },
            },
        });

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        console.error("Create user error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
