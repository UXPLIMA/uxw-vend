import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ActivityFeedList, type ActivityItem } from "@/core/components/activity/ActivityFeedList";
import { prisma } from "@/core/lib/db";
import { buildPageMeta } from "@/core/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    return buildPageMeta({
        title: "Activity Feed",
        description: "Latest activity across the site — posts, trophies, and community events.",
        url: "/activity",
        type: "website",
    });
}

async function fetchPublicFeed(limit = 20): Promise<ActivityItem[]> {
    try {
        const rows = await prisma.activityFeedItem.findMany({
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                actor: { select: { id: true, username: true, avatar: true } },
            },
        });
        return rows.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            body: r.body,
            href: r.href,
            icon: r.icon,
            isPublic: r.isPublic,
            createdAt: r.createdAt.toISOString(),
            actor: r.actor,
        }));
    } catch {
        return [];
    }
}

export default async function ActivityFeedPage() {
    const items = await fetchPublicFeed(20);

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Activity className="w-7 h-7" />
                        Activity Feed
                    </h1>
                    <p className="text-muted-foreground">Latest activity across the site</p>
                </div>

                <ActivityFeedList items={items} />
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
