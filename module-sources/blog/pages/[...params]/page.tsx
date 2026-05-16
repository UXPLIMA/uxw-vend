import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { prisma } from "@/core/lib/db";
import { formatDate } from "@/core/lib/utils";
import { Navbar, Footer } from "@/core/components/layout";
import { Slot } from "@/core/components/Slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { buildArticleJsonLd } from "@/core/lib/seo";
import { CommentSection } from "../../components/CommentSection";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface PageProps {
    params: Promise<Record<string, unknown>>;
}

/** Resolve the article lookup key (slug or numeric id) from dynamic params. */
function extractLookup(resolved: Record<string, unknown>): string {
    const raw = (resolved.params as string | string[]) || (resolved.slug as string[]);
    const segments = typeof raw === "string" ? raw.split("/") : Array.isArray(raw) ? raw : [String(raw)];
    const blogIdx = segments.indexOf("blog");
    return blogIdx >= 0 && segments[blogIdx + 1] ? segments[blogIdx + 1] : segments[0];
}

async function getArticle(lookup: string) {
    const num = Number(lookup);
    const article = await prisma.blogArticle.findFirst({
        where: {
            ...(isNaN(num) ? { slug: lookup } : { number: num }),
            status: "PUBLISHED",
            publishedAt: { lte: new Date() },
        },
        include: {
            author: { select: { username: true, avatar: true } },
            category: { select: { name: true, slug: true } },
            tags: { select: { name: true, slug: true } },
        },
    });

    if (article) {
        // Increment view count
        await prisma.blogArticle.update({
            where: { id: article.id },
            data: { views: { increment: 1 } },
        });
    }

    return article;
}

async function getRelatedArticles(articleId: string, categoryId: string | null) {
    return prisma.blogArticle.findMany({
        where: {
            id: { not: articleId },
            status: "PUBLISHED",
            publishedAt: { lte: new Date() },
            ...(categoryId ? { categoryId } : {}),
        },
        take: 3,
        orderBy: { publishedAt: "desc" },
        select: {
            id: true,
            number: true,
            title: true,
            slug: true,
            coverImage: true,
            publishedAt: true,
        },
    });
}

export default async function BlogArticlePage({ params }: PageProps) {
    const resolvedParams = await params;
    const lookup = extractLookup(resolvedParams);
    const article = await getArticle(lookup);

    if (!article) {
        notFound();
    }

    const relatedArticles = await getRelatedArticles(article.id, article.categoryId);

    const articleJsonLd = buildArticleJsonLd({
        title: article.title,
        description: article.excerpt || undefined,
        image: article.coverImage || undefined,
        url: `/blog/${article.slug}`,
        datePublished: article.publishedAt?.toISOString(),
        dateModified: article.updatedAt?.toISOString(),
        authorName: article.author?.username ?? "Unknown",
    });

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: articleJsonLd }}
            />
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                <StandardSidebarLayout sidebar={(
                            <aside className="space-y-6">
                                {/* Related Articles */}
                                {relatedArticles.length > 0 && (
                                    <div className="bg-card rounded-xl border border-border p-5">
                                        <h3 className="font-bold text-foreground mb-4">Related Articles</h3>
                                        <div className="space-y-4">
                                            {relatedArticles.map((related) => (
                                                <Link
                                                    key={related.id}
                                                    href={`/blog/${related.number}/${related.slug}`}
                                                    className="block group"
                                                >
                                                    {related.coverImage && (
                                                        <div className="h-24 rounded-lg overflow-hidden mb-2">
                                                            <Image
                                                                src={related.coverImage}
                                                                alt={related.title}
                                                                width={0}
                                                                height={0}
                                                                sizes="100vw"
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                            />
                                                        </div>
                                                    )}
                                                    <h4 className="text-sm font-medium text-foreground group-hover:text-blue-600 transition-colors line-clamp-2">
                                                        {related.title}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {formatDate(related.publishedAt || new Date())}
                                                    </p>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Share */}
                                <div className="bg-card rounded-xl border border-border p-5">
                                    <h3 className="font-bold text-foreground mb-4">Share</h3>
                                    <div className="flex gap-2">
                                        <button className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
                                            Twitter
                                        </button>
                                        <button className="flex-1 py-2 px-4 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 transition-colors">
                                            Facebook
                                        </button>
                                    </div>
                                </div>
                            </aside>
                        )}>
                    {(
                            <div className="lg:col-span-3">
                                {/* Breadcrumb */}
                                <div className="text-sm text-muted-foreground mb-6">
                                    <Link href="/" className="hover:text-blue-600">Home</Link>
                                    <span className="mx-2">/</span>
                                    <Link href="/blog" className="hover:text-blue-600">Blog</Link>
                                    {article.category && (
                                        <>
                                            <span className="mx-2">/</span>
                                            <Link href={`/blog/category/${article.category.slug}`} className="hover:text-blue-600">
                                                {article.category.name}
                                            </Link>
                                        </>
                                    )}
                                    <span className="mx-2">/</span>
                                    <span className="text-foreground">{article.title}</span>
                                </div>

                                {/* Main Content */}
                                <article className="bg-card rounded-xl border border-border overflow-hidden">
                                    {article.coverImage && (
                                        <div className="h-64 md:h-96 overflow-hidden">
                                            <Image
                                                src={article.coverImage}
                                                alt={article.title}
                                                width={0}
                                                height={0}
                                                sizes="100vw"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="p-6 md:p-8">
                                        {/* Meta */}
                                        <div className="flex items-center gap-4 mb-4">
                                            {article.category && (
                                                <Link
                                                    href={`/blog/category/${article.category.slug}`}
                                                    className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                                                >
                                                    {article.category.name}
                                                </Link>
                                            )}
                                            <span className="text-sm text-muted-foreground">
                                                {formatDate(article.publishedAt || article.createdAt)}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {article.views} views
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                                            {article.title}
                                        </h1>

                                        {/* Author (may be null when account was deleted) */}
                                        {article.author && (
                                            <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border">
                                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                                                    {article.author.avatar ? (
                                                        <Image src={article.author.avatar} alt={article.author.username} width={40} height={40} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        article.author.username.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">{article.author.username}</p>
                                                    <p className="text-sm text-muted-foreground">Author</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Slot: above article content — e.g. related products, author box, ad */}
                                        <Slot name="blog.article.aboveContent" context={{ articleId: article.id, articleSlug: article.slug }} />

                                        {/* Content — RichTextEditor stores HTML, sanitize before render */}
                                        <div
                                            className="prose prose-lg dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
                                        />


                                        {/* Slot: below article content */}
                                        <Slot name="blog.article.belowContent" context={{ articleId: article.id, articleSlug: article.slug }} />

                                        {/* Tags */}
                                        {article.tags.length > 0 && (
                                            <div className="mt-8 pt-8 border-t border-border">
                                                <div className="flex flex-wrap gap-2">
                                                    {article.tags.map((tag) => (
                                                        <Link
                                                            key={tag.slug}
                                                            href={`/blog/tag/${tag.slug}`}
                                                            className="px-3 py-1 rounded-full bg-muted text-foreground text-sm hover:bg-muted transition-colors"
                                                        >
                                                            #{tag.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Comment Section */}
                                        <CommentSection articleId={article.id} />
                                    </div>
                                </article>
                            </div>
                        )}
                </StandardSidebarLayout>
            </main>

            <Footer />
        </div>
    );
}
