import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function generateOrderNumber() {
    return `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

async function main() {
    console.log("🌱 Seeding database...\n");

    // ==================== ROLES ====================
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
    console.log("✅ Roles");

    // ==================== PERMISSIONS ====================
    for (const perm of [
        "admin.access", "admin.settings", "admin.users", "admin.roles",
        "store.view", "store.manage", "blog.view", "blog.manage",
        "support.view", "support.manage", "forum.view", "forum.manage", "forum.moderate",
    ]) {
        await prisma.permission.upsert({
            where: { name: perm },
            update: {},
            create: { name: perm, module: perm.split(".")[0], description: perm },
        });
    }
    console.log("✅ Permissions");

    // ==================== USERS ====================
    const pw = await bcrypt.hash("password123", 12);

    const admin = await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: { password: pw, roleId: adminRole.id },
        create: { email: "admin@example.com", username: "uxwadmin", password: pw, roleId: adminRole.id },
    });

    const mod = await prisma.user.upsert({
        where: { email: "mod@example.com" },
        update: { roleId: modRole.id },
        create: { email: "mod@example.com", username: "ModSteve", password: pw, roleId: modRole.id, creditBalance: 150 },
    });

    const users = [];
    const userNames = [
        { email: "alex@example.com", username: "xAlex", credit: 250 },
        { email: "john@example.com", username: "ProGamer_John", credit: 80 },
        { email: "sarah@example.com", username: "SarahCraft", credit: 420 },
        { email: "mike@example.com", username: "MikeMiner", credit: 30 },
        { email: "emma@example.com", username: "EmmaBuilds", credit: 175 },
    ];

    for (const u of userNames) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { email: u.email, username: u.username, password: pw, roleId: memberRole.id, creditBalance: u.credit },
        });
        users.push(user);
    }
    console.log("✅ Users (admin + mod + 5 members)");

    // ==================== STORE CATEGORIES ====================
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
    console.log("✅ Store categories");

    // ==================== PRODUCTS ====================
    const productData = [
        { name: "VIP Rank", slug: "vip-rank", price: 9.99, image: "/background2.png", description: "Access VIP features|Priority queue|Custom chat color|VIP kit", categoryId: catRanks.id, isFeatured: true },
        { name: "MVP Rank", slug: "mvp-rank", price: 19.99, comparePrice: 24.99, image: "/background3.png", description: "All VIP features|Fly in lobby|Special effects|Monthly crate", categoryId: catRanks.id, isFeatured: true },
        { name: "Legend Rank", slug: "legend-rank", price: 49.99, comparePrice: 59.99, image: "/background4.png", description: "All MVP features|Custom join message|Pet companion|Exclusive cosmetics|Priority support", categoryId: catRanks.id, isFeatured: true },
        { name: "Vote Key", slug: "vote-key", price: 1.99, image: "/background5.png", description: "Open the Vote Crate", categoryId: catKeys.id, stock: 999 },
        { name: "Legendary Key", slug: "legendary-key", price: 4.99, image: "/background6.png", description: "Open the Legendary Crate", categoryId: catKeys.id, stock: 500 },
    ];

    const products = [];
    for (const p of productData) {
        const prod = await prisma.product.upsert({
            where: { slug: p.slug },
            update: { image: p.image },
            create: { ...p, isActive: true },
        });
        products.push(prod);
    }
    console.log("✅ Products");

    // ==================== ORDERS ====================
    const orderStatuses: ("COMPLETED" | "PENDING" | "PROCESSING")[] = ["COMPLETED", "COMPLETED", "COMPLETED", "PENDING", "PROCESSING"];
    for (let i = 0; i < 8; i++) {
        const user = users[i % users.length];
        const product = products[i % products.length];
        const status = orderStatuses[i % orderStatuses.length];
        const qty = Math.ceil(Math.random() * 3);
        const total = Number(product.price) * qty;

        await prisma.order.create({
            data: {
                orderNumber: generateOrderNumber(),
                userId: user.id,
                status,
                subtotal: total,
                discount: 0,
                total,
                paymentMethod: "stripe",
                items: {
                    create: { productId: product.id, name: product.name, price: product.price, quantity: qty },
                },
            },
        });
    }
    console.log("✅ Orders (8)");

    // ==================== BLOG ====================
    const newsCategory = await prisma.blogCategory.upsert({
        where: { slug: "news" },
        update: {},
        create: { name: "News", slug: "news", description: "Server news and updates" },
    });
    const eventsCategory = await prisma.blogCategory.upsert({
        where: { slug: "events" },
        update: {},
        create: { name: "Events", slug: "events", description: "Community events" },
    });

    const blogArticles = [
        { title: "Server Launch Announcement", slug: "server-launch", excerpt: "We are excited to announce the official launch!", coverImage: "/background1.png", content: "We are thrilled to announce that our server is now officially live!\n\n**What to expect:**\n- Survival mode with custom features\n- Active staff team\n- Regular events and updates\n\nJoin us today!", status: "PUBLISHED" as const, publishedAt: new Date(), categoryId: newsCategory.id },
        { title: "Spring Sale - 30% Off Everything", slug: "spring-sale", excerpt: "Don't miss our biggest sale of the season!", coverImage: "/background2.png", content: "Spring is here and so is our biggest sale!\n\nUse code **SPRING30** at checkout.\n\nSale ends April 15th.", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 86400000), categoryId: newsCategory.id },
        { title: "New Gamemode: SkyBlock", slug: "new-skyblock", excerpt: "Introducing our brand new SkyBlock gamemode.", coverImage: "/background3.png", content: "Start on your own floating island and build your way to the top.\n\n- Custom island templates\n- 50+ challenges\n- Island leveling system\n- Weekly top island rewards", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 172800000), categoryId: newsCategory.id },
        { title: "Build Competition: Medieval Castle", slug: "build-competition", excerpt: "Show off your building skills! Amazing prizes await.", coverImage: "/background4.png", content: "This month's theme: **Medieval Castle**\n\nPrizes:\n- 1st: Legend Rank + 500 Credits\n- 2nd: MVP Rank + 250 Credits\n- 3rd: VIP Rank + 100 Credits", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 259200000), categoryId: eventsCategory.id },
        { title: "Survival Season 2 Begins", slug: "survival-season-2", excerpt: "A fresh start with new features and challenges.", coverImage: "/background5.png", content: "Season 2 brings:\n- New world generation\n- Custom enchantments\n- Seasonal battle pass\n- New boss fights\n\nAll progress from Season 1 has been archived.", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 345600000), categoryId: newsCategory.id },
        { title: "Staff Applications Open", slug: "staff-applications-open", excerpt: "We're looking for new moderators to join the team.", coverImage: "/background6.png", content: "Requirements:\n- 16+ years old\n- Active 10+ hours/week\n- Clean punishment history\n- Good communication skills\n\nApply at /staff on our website.", status: "PUBLISHED" as const, publishedAt: new Date(Date.now() - 432000000), categoryId: newsCategory.id },
    ];

    const createdArticles = [];
    for (const article of blogArticles) {
        const a = await prisma.blogArticle.upsert({
            where: { slug: article.slug },
            update: { coverImage: article.coverImage },
            create: { ...article, authorId: admin.id },
        });
        createdArticles.push(a);
    }

    // Blog comments
    const comments = [
        "Great news! Can't wait to try it out!",
        "Finally! I've been waiting for this.",
        "This is awesome, thanks for the update!",
        "When will the next event start?",
        "Love the new features!",
        "Best server ever! Keep up the good work.",
    ];
    for (let i = 0; i < comments.length; i++) {
        await prisma.blogComment.create({
            data: {
                content: comments[i],
                articleId: createdArticles[i % createdArticles.length].id,
                authorId: users[i % users.length].id,
            },
        });
    }
    console.log("✅ Blog articles (6) + comments (6)");

    // ==================== FORUM ====================
    const forumGeneral = await prisma.forumCategory.upsert({
        where: { slug: "general" },
        update: {},
        create: { name: "General", slug: "general", description: "General discussions", icon: "💬", color: "#3b82f6", order: 0 },
    });
    const forumSuggestions = await prisma.forumCategory.upsert({
        where: { slug: "suggestions" },
        update: {},
        create: { name: "Suggestions", slug: "suggestions", description: "Share your ideas", icon: "💡", color: "#22c55e", order: 1 },
    });
    const forumSupport = await prisma.forumCategory.upsert({
        where: { slug: "support" },
        update: {},
        create: { name: "Support", slug: "support", description: "Get help from the community", icon: "🆘", color: "#ef4444", order: 2 },
    });

    const forumTopics = [
        { title: "Welcome to the server!", slug: "welcome", content: "Hey everyone! Welcome to our Minecraft server community. Feel free to introduce yourselves here!", categoryId: forumGeneral.id, authorId: admin.id, isPinned: true },
        { title: "Server rules - Please read!", slug: "server-rules", content: "1. No hacking or cheating\n2. Be respectful to all players\n3. No spamming in chat\n4. No advertising\n5. Follow staff instructions\n\nBreaking rules will result in warnings, mutes, or bans.", categoryId: forumGeneral.id, authorId: admin.id, isPinned: true },
        { title: "Add more PvP arenas", slug: "add-pvp-arenas", content: "I think the server needs more PvP arenas. The current one gets too crowded during peak hours. Maybe add a 1v1 dueling system too?", categoryId: forumSuggestions.id, authorId: users[0].id },
        { title: "Custom enchantment ideas", slug: "custom-enchant-ideas", content: "Here are some enchantment ideas:\n- Telekinesis: items go directly to inventory\n- Excavation: mine 3x3 area\n- Vein Miner: mine entire ore vein\n\nWhat do you guys think?", categoryId: forumSuggestions.id, authorId: users[1].id },
        { title: "Can't connect to the server", slug: "cant-connect", content: "I'm getting a connection timeout when trying to join. I'm using Minecraft 1.21. Is the server on a different version? Please help!", categoryId: forumSupport.id, authorId: users[2].id },
        { title: "Best base locations?", slug: "best-base-locations", content: "What are some good spots to build a base? I'm looking for somewhere with good resources nearby and not too many players.", categoryId: forumGeneral.id, authorId: users[3].id },
        { title: "Trading system feedback", slug: "trading-feedback", content: "The new trading system is great but it could use some improvements. A search function would be nice so we can find items faster.", categoryId: forumSuggestions.id, authorId: users[4].id },
    ];

    for (const topic of forumTopics) {
        const t = await prisma.forumTopic.upsert({
            where: { slug: topic.slug },
            update: {},
            create: topic,
        });
        // Add replies
        const replyCount = Math.floor(Math.random() * 4) + 1;
        const replies = [
            "I agree with this!", "Thanks for sharing.", "Good point, +1",
            "This would be amazing!", "I hope the staff considers this.",
            "Same issue here.", "Try restarting your client.",
            "Nice idea! I'd love to see this implemented.",
        ];
        for (let j = 0; j < replyCount; j++) {
            await prisma.forumPost.create({
                data: {
                    content: replies[(j + forumTopics.indexOf(topic)) % replies.length],
                    topicId: t.id,
                    authorId: users[(j + 1) % users.length].id,
                },
            });
        }
    }
    console.log("✅ Forum topics (7) + replies");

    // ==================== TICKETS ====================
    for (const dept of [
        { id: "general-dept", name: "General Support", description: "General questions", color: "#3b82f6" },
        { id: "billing-dept", name: "Billing", description: "Payment and order issues", color: "#f59e0b" },
        { id: "report-dept", name: "Player Reports", description: "Report rule breakers", color: "#ef4444" },
    ]) {
        await prisma.ticketDepartment.upsert({
            where: { id: dept.id },
            update: {},
            create: { ...dept, isActive: true },
        });
    }

    const tickets = [
        { subject: "I didn't receive my VIP rank", departmentId: "billing-dept", userId: users[0].id, priority: "HIGH" as const, status: "OPEN" as const },
        { subject: "Player griefing my base", departmentId: "report-dept", userId: users[1].id, priority: "MEDIUM" as const, status: "IN_PROGRESS" as const },
        { subject: "How do I claim my daily reward?", departmentId: "general-dept", userId: users[2].id, priority: "LOW" as const, status: "RESOLVED" as const },
        { subject: "Refund request for duplicate purchase", departmentId: "billing-dept", userId: users[3].id, priority: "HIGH" as const, status: "OPEN" as const },
    ];

    for (const ticket of tickets) {
        await prisma.ticket.create({
            data: {
                ...ticket,
                messages: {
                    create: {
                        content: `Hello, I need help with: ${ticket.subject}`,
                        userId: ticket.userId,
                        isStaffReply: false,
                    },
                },
            },
        });
    }
    console.log("✅ Tickets (4)");

    // ==================== MODULES ====================
    for (const mod of ["store", "blog", "support", "forum"]) {
        await prisma.moduleConfig.upsert({
            where: { id: mod },
            update: {},
            create: { id: mod, name: `${mod.charAt(0).toUpperCase()}${mod.slice(1)} Module`, enabled: true },
        });
    }
    console.log("✅ Modules");

    // ==================== WHEEL PRIZES ====================
    // Delete existing first to avoid duplicates
    await prisma.wheelPrize.deleteMany();
    for (const [i, prize] of [
        { name: "10 Credits", type: "credits", value: 10, color: "#3b82f6", probability: 30 },
        { name: "25 Credits", type: "credits", value: 25, color: "#22c55e", probability: 20 },
        { name: "50 Credits", type: "credits", value: 50, color: "#8b5cf6", probability: 10 },
        { name: "$5 Coupon", type: "coupon", value: 5, color: "#f59e0b", probability: 10 },
        { name: "Better Luck!", type: "nothing", value: 0, color: "#6b7280", probability: 30 },
    ].entries()) {
        await prisma.wheelPrize.create({ data: { ...prize, order: i } });
    }
    console.log("✅ Wheel prizes");

    // ==================== COUPONS ====================
    await prisma.coupon.upsert({
        where: { code: "WELCOME10" },
        update: {},
        create: { code: "WELCOME10", type: "PERCENTAGE", value: 10, description: "Welcome discount - 10% off", usageLimit: 100, isActive: true },
    });
    await prisma.coupon.upsert({
        where: { code: "SPRING30" },
        update: {},
        create: { code: "SPRING30", type: "PERCENTAGE", value: 30, description: "Spring sale - 30% off", usageLimit: 50, isActive: true, expiresAt: new Date(Date.now() + 30 * 86400000) },
    });
    await prisma.coupon.upsert({
        where: { code: "VIP5OFF" },
        update: {},
        create: { code: "VIP5OFF", type: "FIXED", value: 5, description: "$5 off any purchase", minPurchase: 15, usageLimit: 200, isActive: true },
    });
    console.log("✅ Coupons (3)");

    // ==================== SUGGESTIONS ====================
    const suggestions = [
        { title: "Add a player marketplace", content: "It would be great if players could sell items to each other through the website.", authorId: users[0].id, upvotes: 12, status: "accepted" },
        { title: "Mobile app for the website", content: "A mobile app would make it easier to manage everything on the go.", authorId: users[1].id, upvotes: 8, status: "under_review" },
        { title: "Seasonal battle pass", content: "Similar to Fortnite's battle pass but for Minecraft. Complete challenges to earn exclusive rewards.", authorId: users[2].id, upvotes: 25, status: "open" },
    ];
    for (const s of suggestions) {
        await prisma.suggestion.upsert({
            where: { id: s.title.toLowerCase().replace(/\s+/g, "-").slice(0, 20) },
            update: {},
            create: s,
        }).catch(() => prisma.suggestion.create({ data: s }));
    }
    console.log("✅ Suggestions (3)");

    // ==================== ANNOUNCEMENTS ====================
    const existingAnn = await prisma.announcement.findFirst({ where: { title: "Spring Sale is Live!" } });
    if (!existingAnn) {
        await prisma.announcement.create({
            data: { title: "Spring Sale is Live!", content: "Use code SPRING30 for 30% off everything. Limited time only!", type: "success", isActive: true },
        });
    }
    console.log("✅ Announcements");

    // ==================== STAFF MEMBERS ====================
    await prisma.staffMember.create({
        data: { name: "uxwadmin", role: "Owner & Developer", userId: admin.id, order: 0 },
    }).catch(() => {});
    await prisma.staffMember.create({
        data: { name: "ModSteve", role: "Head Moderator", userId: mod.id, order: 1 },
    }).catch(() => {});
    console.log("✅ Staff members");

    // ==================== VOTE SITES ====================
    await prisma.voteSite.create({
        data: { name: "MinecraftServers.org", url: "https://minecraftservers.org", reward: 10, icon: "🗳️", order: 0 },
    }).catch(() => {});
    await prisma.voteSite.create({
        data: { name: "TopG.org", url: "https://topg.org", reward: 15, icon: "⭐", order: 1 },
    }).catch(() => {});
    console.log("✅ Vote sites (2)");

    // ==================== CREDIT TRANSACTIONS ====================
    for (const user of users) {
        if (Number(user.creditBalance) > 0) {
            await prisma.creditTransaction.create({
                data: { userId: user.id, amount: user.creditBalance, type: "purchase", description: "Initial credit purchase" },
            });
        }
    }
    console.log("✅ Credit transactions");

    // ==================== CHANGELOG ====================
    const changelogs = [
        { version: "1.0.0", title: "Initial Release", content: "Server launch with Survival gamemode, store, forum, and support system.", type: "feature" },
        { version: "1.1.0", title: "SkyBlock Gamemode", content: "Added SkyBlock with custom islands, 50+ challenges, and weekly rewards.", type: "feature" },
        { version: "1.1.1", title: "Bug Fixes", content: "- Fixed chest duplication glitch\n- Fixed scoreboard flickering\n- Improved server performance", type: "fix" },
        { version: "1.2.0", title: "Trading System", content: "Players can now trade items with each other through a secure trading interface.", type: "feature" },
    ];
    for (const cl of changelogs) {
        await prisma.changelogEntry.create({ data: cl }).catch(() => {});
    }
    console.log("✅ Changelog (4)");

    // ==================== HELP CENTER ====================
    const helpCat = await prisma.helpCategory.create({
        data: { name: "Getting Started", slug: "getting-started", description: "New player guides", icon: "📚", order: 0 },
    }).catch(() => null);

    if (helpCat) {
        await prisma.helpArticle.create({
            data: { title: "How to Join the Server", slug: "how-to-join", content: "1. Open Minecraft\n2. Click Multiplayer\n3. Click Add Server\n4. Enter our IP address\n5. Click Done and join!", categoryId: helpCat.id },
        }).catch(() => {});
        await prisma.helpArticle.create({
            data: { title: "Server Rules", slug: "server-rules-help", content: "Please read our rules carefully:\n\n1. No hacking\n2. Be respectful\n3. No spam\n4. No advertising\n5. Have fun!", categoryId: helpCat.id },
        }).catch(() => {});
    }
    console.log("✅ Help center articles");

    // ==================== NAVBAR SETTINGS ====================
    const navbarLinks = [
        { label: "Home", href: "/", icon: "Home" },
        { label: "Store", href: "/store", icon: "ShoppingCart" },
        { label: "Forum", href: "/forum", icon: "MessageSquare" },
        { label: "Support", href: "/support", icon: "HelpCircle" },
        {
            label: "Other", href: "#", icon: "Star",
            children: [
                { label: "Leaderboard", href: "/leaderboard", icon: "Trophy" },
                { label: "Vote for Us", href: "/vote", icon: "Vote" },
                { label: "Wheel of Fortune", href: "/wheel", icon: "Dices" },
                { label: "Suggestions", href: "/suggestions", icon: "MessageSquare" },
                { label: "Changelog", href: "/changelog", icon: "History" },
                { label: "Staff", href: "/staff", icon: "Users" },
                { label: "Downloads", href: "/downloads", icon: "Download" },
                { label: "Punishments", href: "/punishments", icon: "Shield" },
            ],
        },
    ];
    await prisma.setting.upsert({
        where: { key: "navbar_links" },
        update: { value: navbarLinks },
        create: { key: "navbar_links", value: navbarLinks },
    });
    console.log("✅ Navbar with dropdown menu");

    console.log("\n🎉 Seeding complete!");
    console.log("   Accounts (all password: password123):");
    console.log("   - admin@example.com (Admin)");
    console.log("   - mod@example.com (Moderator)");
    console.log("   - alex@example.com, john@example.com, sarah@example.com, mike@example.com, emma@example.com (Members)\n");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
