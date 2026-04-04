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
        update: { image: "/background3.png" },
        create: { name: "Survival", slug: "survival", description: "Survival gamemode items", image: "/background3.png", order: 0 },
    });

    const catRanks = await prisma.category.upsert({
        where: { slug: "ranks" },
        update: { image: "/background4.png" },
        create: { name: "Ranks", slug: "ranks", description: "VIP and donor ranks", image: "/background4.png", parentId: catSurvival.id, order: 0 },
    });

    const catKeys = await prisma.category.upsert({
        where: { slug: "keys" },
        update: { image: "/background5.png" },
        create: { name: "Keys", slug: "keys", description: "Crate keys", image: "/background5.png", parentId: catSurvival.id, order: 1 },
    });
    console.log("✅ Store categories created");

    // Products
    const products = [
        { name: "VIP Rank", slug: "vip-rank", price: 9.99, image: "/background2.png", description: "Access VIP features|Priority queue|Custom chat color|VIP kit", categoryId: catRanks.id, isFeatured: true },
        { name: "MVP Rank", slug: "mvp-rank", price: 19.99, comparePrice: 24.99, image: "/background3.png", description: "All VIP features|Fly in lobby|Special effects|Monthly crate", categoryId: catRanks.id, isFeatured: true },
        { name: "Legend Rank", slug: "legend-rank", price: 49.99, comparePrice: 59.99, image: "/background4.png", description: "All MVP features|Custom join message|Pet companion|Exclusive cosmetics|Priority support", categoryId: catRanks.id, isFeatured: true },
        { name: "Vote Key", slug: "vote-key", price: 1.99, image: "/background5.png", description: "Open the Vote Crate", categoryId: catKeys.id, stock: 999 },
        { name: "Legendary Key", slug: "legendary-key", price: 4.99, image: "/background6.png", description: "Open the Legendary Crate", categoryId: catKeys.id, stock: 500 },
    ];

    for (const p of products) {
        await prisma.product.upsert({
            where: { slug: p.slug },
            update: { image: p.image },
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
    // Blog articles
    const newsCategory = await prisma.blogCategory.findUnique({ where: { slug: "news" } });
    const blogArticles = [
        { title: "Server Launch Announcement", slug: "server-launch", excerpt: "We are excited to announce the official launch of our server! Join us and start your adventure today.", content: "We are thrilled to announce that our server is now officially live! After months of development and testing, we're ready to welcome players from around the world.\n\nWhat to expect:\n- Survival mode with custom features\n- Active staff team\n- Regular events and updates\n- Fair play environment\n\nJoin us today and be part of our growing community!", status: "PUBLISHED" as const, publishedAt: new Date(), categoryId: newsCategory?.id },
        { title: "Spring Sale - 30% Off Everything", slug: "spring-sale", excerpt: "Don't miss our biggest sale of the season! Get 30% off all ranks and items for a limited time.", content: "Spring is here and so is our biggest sale yet! For a limited time, enjoy 30% off everything in the store.\n\nUse code SPRING30 at checkout.\n\nSale ends April 15th. Don't miss out!", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 86400000), categoryId: newsCategory?.id },
        { title: "New Gamemode: SkyBlock", slug: "new-skyblock", excerpt: "Introducing our brand new SkyBlock gamemode with custom islands, challenges, and rewards.", content: "We're excited to introduce SkyBlock to our server! Start on your own floating island and build your way to the top.\n\nFeatures:\n- Custom island templates\n- 50+ challenges\n- Island leveling system\n- Weekly top island rewards", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 172800000), categoryId: newsCategory?.id },
        { title: "Community Event: Build Competition", slug: "build-competition", excerpt: "Show off your building skills in our monthly build competition! Amazing prizes await the winners.", content: "It's time for our monthly build competition! This month's theme is Medieval Castle.\n\nPrizes:\n- 1st Place: Legend Rank + 500 Credits\n- 2nd Place: MVP Rank + 250 Credits\n- 3rd Place: VIP Rank + 100 Credits\n\nSubmissions due by April 20th.", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 259200000), categoryId: newsCategory?.id },
    ];
    for (const article of blogArticles) {
        await prisma.blogArticle.upsert({
            where: { slug: article.slug },
            update: {},
            create: { ...article, authorId: admin.id },
        });
    }
    console.log("✅ Blog articles created");
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
