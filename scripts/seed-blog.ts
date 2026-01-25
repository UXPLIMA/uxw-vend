import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedBlog() {
    console.log("Seeding blog data...");

    // Check or create admin role
    let adminRole = await prisma.role.findFirst({ where: { name: "admin" } });
    if (!adminRole) {
        adminRole = await prisma.role.create({
            data: { name: "admin", displayName: "Administrator", priority: 100 },
        });
        console.log("Created admin role");
    }

    // Check or create admin user
    let admin = await prisma.user.findFirst({
        where: { role: { name: "admin" } },
    });
    if (!admin) {
        const hash = await bcrypt.hash("admin123", 10);
        admin = await prisma.user.create({
            data: {
                email: "admin@test.com",
                username: "admin",
                password: hash,
                roleId: adminRole.id,
            },
        });
        console.log("Created admin user: admin@test.com / admin123");
    }

    // Create category
    let category = await prisma.blogCategory.findFirst({
        where: { slug: "announcements" },
    });
    if (!category) {
        category = await prisma.blogCategory.create({
            data: {
                name: "Announcements",
                slug: "announcements",
                description: "Server announcements and news",
            },
        });
        console.log("Created category: Announcements");
    }

    // Create article
    const existingArticle = await prisma.blogArticle.findFirst();
    if (!existingArticle) {
        const article = await prisma.blogArticle.create({
            data: {
                title: "Welcome to Our Server",
                slug: "welcome-to-our-server",
                excerpt:
                    "Welcome to the best Minecraft server experience! Check out our latest updates and features.",
                content: `Hello players!

We are excited to announce the launch of our new website. Here you can find all the latest news, updates, and information about our server.

## New Features

- **VIP Ranks** with exclusive perks
- **Daily rewards** system
- **Weekend tournaments** with amazing prizes

## Coming Soon

We have many exciting updates planned for the future:

1. New game modes
2. Custom plugins
3. Special events

Stay tuned for more updates!

Thank you for being part of our community.`,
                coverImage:
                    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800",
                status: "PUBLISHED",
                publishedAt: new Date(),
                authorId: admin.id,
                categoryId: category.id,
            },
        });
        console.log("Created article:", article.title);
        console.log("View at: http://localhost:3001/en/blog/" + article.slug);
    } else {
        console.log("Article already exists:", existingArticle.title);
        console.log(
            "View at: http://localhost:3001/en/blog/" + existingArticle.slug
        );
    }

    await prisma.$disconnect();
}

seedBlog().catch(console.error);
