import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/core/lib/db";
import { formatDate } from "@/core/lib/utils";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { CommentSection } from "@/core/components/blog/CommentSection";

interface PageProps {
    params: Promise<{ params: string[] }>;
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
    const { params: segments } = await params;
    const lookup = segments[0]; // number or slug
    const article = await getArticle(lookup);

    if (!article) {
        notFound();
    }

    const relatedArticles = await getRelatedArticles(article.id, article.categoryId);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                <ThemeSlot
                    name="SidebarLayout"
                    defaultComponent={<StandardSidebarLayout sidebar={null as any} children={null} />}
                    props={{
                        children: (
                            <div className="lg:col-span-3">
                                {/* Breadcrumb */}
                                <div className="text-sm text-gray-500 mb-6">
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
                                    <span className="text-gray-700">{article.title}</span>
                                </div>

                                {/* Main Content */}
                                <article className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                    {article.coverImage && (
                                        <div className="h-64 md:h-96 overflow-hidden">
                                            <img
                                                src={article.coverImage}
                                                alt={article.title}
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
                                            <span className="text-sm text-gray-500">
                                                {formatDate(article.publishedAt || article.createdAt)}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {article.views} views
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                                            {article.title}
                                        </h1>

                                        {/* Author */}
                                        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-100">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                                {article.author.avatar ? (
                                                    <img src={article.author.avatar} alt={article.author.username} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    article.author.username.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{article.author.username}</p>
                                                <p className="text-sm text-gray-500">Author</p>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="prose prose-lg max-w-none">
                                            {article.content.split("\n").map((paragraph, index) => (
                                                <p key={index}>{paragraph}</p>
                                            ))}
                                        </div>

                                        {/* Tags */}
                                        {article.tags.length > 0 && (
                                            <div className="mt-8 pt-8 border-t border-gray-100">
                                                <div className="flex flex-wrap gap-2">
                                                    {article.tags.map((tag) => (
                                                        <Link
                                                            key={tag.slug}
                                                            href={`/blog/tag/${tag.slug}`}
                                                            className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors"
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
                        ),
                        sidebar: (
                            <aside className="space-y-6">
                                {/* Related Articles */}
                                {relatedArticles.length > 0 && (
                                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                                        <h3 className="font-bold text-gray-900 mb-4">Related Articles</h3>
                                        <div className="space-y-4">
                                            {relatedArticles.map((related) => (
                                                <Link
                                                    key={related.id}
                                                    href={`/blog/${related.number}/${related.slug}`}
                                                    className="block group"
                                                >
                                                    {related.coverImage && (
                                                        <div className="h-24 rounded-lg overflow-hidden mb-2">
                                                            <img
                                                                src={related.coverImage}
                                                                alt={related.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                            />
                                                        </div>
                                                    )}
                                                    <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                                                        {related.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {formatDate(related.publishedAt || new Date())}
                                                    </p>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Share */}
                                <div className="bg-white rounded-xl border border-gray-100 p-5">
                                    <h3 className="font-bold text-gray-900 mb-4">Share</h3>
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
                        )
                    }}
                />
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
