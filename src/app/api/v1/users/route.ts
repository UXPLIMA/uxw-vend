import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { PER_PAGE_USERS, BCRYPT_ROUNDS, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from "@/core/lib/constants";
import { enforcePasswordPolicy } from "@/core/lib/security-settings";
import bcrypt from "bcryptjs";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";
import { PASSWORD_POLICY } from "@/core/lib/password-policy";

/**
 * An admin creating an account by hand. The password is checked against the
 * live policy below rather than here, so this only bounds what may arrive:
 * `email` used to reach `.toLowerCase()` untyped (a number was a 500) and
 * `username` used to reach a Prisma `equals` clause untyped, where an object
 * is a filter operator rather than a name.
 */
const createUserSchema = z.object({
    email: z.string().email().max(254),
    username: z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH),
    password: z.string().min(1).max(PASSWORD_POLICY.MAX_LENGTH),
    roleId: z.string().max(64).optional().nullable(),
});

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

        const body = await readJsonBody(request);
        if (body instanceof NextResponse) return body;
        const parsed = createUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Email, username, and password are required" },
                { status: 400 }
            );
        }
        const { email, username, password, roleId } = parsed.data;

        // An admin-created account signs in through the same form as any
        // other, so it answers to the same policy. This route used to check
        // length alone, against a looser constant than the policy's own.
        const policyCheck = await enforcePasswordPolicy(password);
        if (!policyCheck.ok) {
            return NextResponse.json(
                { error: policyCheck.message ?? "Password does not meet the policy", code: policyCheck.reason },
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
        let assignRoleId: string | null | undefined = roleId;
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
