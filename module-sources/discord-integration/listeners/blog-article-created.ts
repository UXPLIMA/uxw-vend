import { sendDiscordWebhook } from "../lib/discord";

interface BlogArticlePayload {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    status: string;
    author?: { username: string } | null;
    category?: { name: string } | null;
}

/**
 * Hook listener: fires on `blog.article.created`.
 * Sends a Discord webhook when a new blog article is published.
 */
export default async function onBlogArticleCreated(payload: BlogArticlePayload): Promise<void> {
    if (payload.status !== "PUBLISHED") return;

    await sendDiscordWebhook("blog_article_created", {
        embeds: [{
            title: "New Blog Article",
            description: `**${payload.title}**${payload.excerpt ? `\n\n${payload.excerpt}` : ""}`,
            color: 0x10b981,
            fields: [
                ...(payload.author ? [{ name: "Author", value: payload.author.username, inline: true }] : []),
                ...(payload.category ? [{ name: "Category", value: payload.category.name, inline: true }] : []),
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}
