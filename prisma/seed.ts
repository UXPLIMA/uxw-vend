import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

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
    const pw = await bcrypt.hash("password123", 12);

    await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: { password: pw, roleId: adminRole.id },
        create: { email: "admin@example.com", username: "uxwadmin", password: pw, roleId: adminRole.id },
    });
    console.log("[ok]Admin user");

    console.log("\n[done]Seeding complete!");
    console.log("   Admin account (password: password123):");
    console.log("   - admin@example.com\n");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
