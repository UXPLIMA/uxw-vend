import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...\n");

    // Roles
    const adminRole = await prisma.role.upsert({
        where: { name: "admin" },
        update: {},
        create: { name: "admin", displayName: "Administrator", color: "#ef4444", priority: 100 },
    });

    const modRole = await prisma.role.upsert({
        where: { name: "moderator" },
        update: {},
        create: { name: "moderator", displayName: "Moderator", color: "#8b5cf6", priority: 50 },
    });

    const memberRole = await prisma.role.upsert({
        where: { name: "member" },
        update: {},
        create: { name: "member", displayName: "Member", color: "#6b7280", priority: 0, isDefault: true },
    });

    console.log("✅ Roles created");

    // Admin user
    const adminPassword = await bcrypt.hash("admin123", 12);
    const admin = await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: { password: adminPassword, roleId: adminRole.id },
        create: {
            email: "admin@example.com",
            username: "uxwadmin",
            password: adminPassword,
            roleId: adminRole.id,
        },
    });
    console.log("✅ Admin user: admin@example.com / admin123 (username: uxwadmin)");

    // Permissions
    const permissions = [
        { name: "admin.access", module: "core" },
        { name: "admin.settings", module: "core" },
        { name: "admin.users", module: "core" },
        { name: "admin.roles", module: "core" },
        { name: "store.view", module: "store" },
        { name: "store.manage", module: "store" },
        { name: "blog.view", module: "blog" },
        { name: "blog.manage", module: "blog" },
        { name: "support.view", module: "support" },
        { name: "support.manage", module: "support" },
        { name: "forum.view", module: "forum" },
        { name: "forum.manage", module: "forum" },
        { name: "forum.moderate", module: "forum" },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: { name: perm.name, module: perm.module, description: perm.name },
        });
    }
    console.log("✅ Permissions created");

    // Store categories
    const catSurvival = await prisma.category.upsert({
        where: { slug: "survival" },
        update: {},
        create: { name: "Survival", slug: "survival", description: "Survival gamemode items", order: 0 },
    });

    const catRanks = await prisma.category.upsert({
        where: { slug: "ranks" },
        update: {},
        create: { name: "Ranks", slug: "ranks", description: "VIP and donor ranks", parentId: catSurvival.id, order: 0 },
    });

    const catKeys = await prisma.category.upsert({
        where: { slug: "keys" },
        update: {},
        create: { name: "Keys", slug: "keys", description: "Crate keys", parentId: catSurvival.id, order: 1 },
    });
    console.log("✅ Store categories created");

    // Products
    const products = [
        { name: "VIP Rank", slug: "vip-rank", price: 9.99, description: "Access VIP features|Priority queue|Custom chat color|VIP kit", categoryId: catRanks.id, isFeatured: true },
        { name: "MVP Rank", slug: "mvp-rank", price: 19.99, comparePrice: 24.99, description: "All VIP features|Fly in lobby|Special effects|Monthly crate", categoryId: catRanks.id, isFeatured: true },
        { name: "Legend Rank", slug: "legend-rank", price: 49.99, comparePrice: 59.99, description: "All MVP features|Custom join message|Pet companion|Exclusive cosmetics|Priority support", categoryId: catRanks.id, isFeatured: true },
        { name: "Vote Key", slug: "vote-key", price: 1.99, description: "Open the Vote Crate", categoryId: catKeys.id, stock: 999 },
        { name: "Legendary Key", slug: "legendary-key", price: 4.99, description: "Open the Legendary Crate", categoryId: catKeys.id, stock: 500 },
    ];

    for (const p of products) {
        await prisma.product.upsert({
            where: { slug: p.slug },
            update: {},
            create: { ...p, isActive: true },
        });
    }
    console.log("✅ Products created");

    // Blog categories
    await prisma.blogCategory.upsert({
        where: { slug: "news" },
        update: {},
        create: { name: "News", slug: "news", description: "Server news and updates" },
    });
    await prisma.blogCategory.upsert({
        where: { slug: "events" },
        update: {},
        create: { name: "Events", slug: "events", description: "Community events" },
    });
    console.log("✅ Blog categories created");

    // Forum categories
    await prisma.forumCategory.upsert({
        where: { slug: "general" },
        update: {},
        create: { name: "General", slug: "general", description: "General discussions", icon: "💬", color: "#3b82f6", order: 0 },
    });
    await prisma.forumCategory.upsert({
        where: { slug: "suggestions" },
        update: {},
        create: { name: "Suggestions", slug: "suggestions", description: "Share your ideas", icon: "💡", color: "#22c55e", order: 1 },
    });
    await prisma.forumCategory.upsert({
        where: { slug: "support" },
        update: {},
        create: { name: "Support", slug: "support", description: "Get help from the community", icon: "🆘", color: "#ef4444", order: 2 },
    });
    console.log("✅ Forum categories created");

    // Ticket departments
    await prisma.ticketDepartment.upsert({
        where: { id: "general-dept" },
        update: {},
        create: { id: "general-dept", name: "General Support", description: "General questions", color: "#3b82f6", isActive: true },
    });
    await prisma.ticketDepartment.upsert({
        where: { id: "billing-dept" },
        update: {},
        create: { id: "billing-dept", name: "Billing", description: "Payment and order issues", color: "#f59e0b", isActive: true },
    });
    await prisma.ticketDepartment.upsert({
        where: { id: "report-dept" },
        update: {},
        create: { id: "report-dept", name: "Player Reports", description: "Report rule breakers", color: "#ef4444", isActive: true },
    });
    console.log("✅ Ticket departments created");

    // Modules
    for (const mod of ["store", "blog", "support", "forum"]) {
        await prisma.moduleConfig.upsert({
            where: { id: mod },
            update: {},
            create: { id: mod, name: `${mod.charAt(0).toUpperCase()}${mod.slice(1)} Module`, enabled: true },
        });
    }
    console.log("✅ Modules enabled");

    // Wheel prizes
    const wheelPrizes = [
        { name: "10 Credits", type: "credits", value: 10, color: "#3b82f6", probability: 30 },
        { name: "25 Credits", type: "credits", value: 25, color: "#22c55e", probability: 20 },
        { name: "50 Credits", type: "credits", value: 50, color: "#8b5cf6", probability: 10 },
        { name: "$5 Coupon", type: "coupon", value: 5, color: "#f59e0b", probability: 10 },
        { name: "Better Luck!", type: "nothing", value: 0, color: "#6b7280", probability: 30 },
    ];

    for (let i = 0; i < wheelPrizes.length; i++) {
        await prisma.wheelPrize.create({ data: { ...wheelPrizes[i], order: i } });
    }
    console.log("✅ Wheel prizes created");

    console.log("\n🎉 Seeding complete!");
    console.log("   Admin login: admin@example.com / admin123\n");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
