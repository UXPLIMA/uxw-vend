// Reads DATABASE_URL from .env — this script is run directly via tsx,
// outside Next.js, which is what normally loads the env file.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
    console.log("[seed]Seeding database...\n");

    // ==================== ROLES ====================
    const adminRole = await prisma.role.upsert({
        where: { name: "admin" },
        update: {},
        create: { name: "admin", displayName: "Administrator", color: "#ef4444", priority: 100 },
    });
    await prisma.role.upsert({
        where: { name: "moderator" },
        update: {},
        create: { name: "moderator", displayName: "Moderator", color: "#8b5cf6", priority: 50 },
    });
    await prisma.role.upsert({
        where: { name: "member" },
        update: {},
        create: { name: "member", displayName: "Member", color: "#6b7280", priority: 0, isDefault: true },
    });
    console.log("[ok]Roles");

    // ==================== PERMISSIONS ====================
    for (const perm of [
        "admin.access", "admin.settings", "admin.users", "admin.roles",
    ]) {
        await prisma.permission.upsert({
            where: { name: perm },
            update: {},
            create: { name: perm, module: perm.split(".")[0], description: perm },
        });
    }
    console.log("[ok]Permissions");

    // ==================== ADMIN USER ====================
    // No fixed default: a shipped password ends up unchanged on real
    // deployments, and "password123" is on core's own weak-password list.
    // Set SEED_ADMIN_PASSWORD to choose one; otherwise a random one is
    // generated and printed once, here, and never again.
    const generated = !process.env.SEED_ADMIN_PASSWORD;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(18).toString("base64url");
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
    const pw = await bcrypt.hash(adminPassword, 12);

    // `update` deliberately leaves `password` alone: re-seeding an existing
    // install must not reset an admin's chosen password.
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { roleId: adminRole.id },
        create: { email: adminEmail, username: "uxwadmin", password: pw, roleId: adminRole.id },
    });
    const created = admin.createdAt.getTime() === admin.updatedAt.getTime();
    console.log("[ok]Admin user");

    console.log("\n[done]Seeding complete!");
    if (created) {
        console.log(`   Admin account: ${adminEmail}`);
        if (generated) {
            console.log(`   Generated password (shown once): ${adminPassword}`);
            console.log("   Set SEED_ADMIN_PASSWORD to choose your own.\n");
        } else {
            console.log("   Password: the SEED_ADMIN_PASSWORD you supplied.\n");
        }
    } else {
        console.log(`   Admin account ${adminEmail} already existed — password left unchanged.\n`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
