import Link from "next/link";
import { prisma } from "@/core/lib/db";
import { formatDate } from "@/core/lib/utils";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { NewsGrid } from "@/core/components/blog/news-grid";

export const revalidate = 60;

async function getBlogArticles() {
    const articles = await prisma.blogArticle.findMany({
        where: {
            status: "PUBLISHED",
            publishedAt: { lte: new Date() },
        },
        orderBy: { publishedAt: "desc" },
        include: {
            author: { select: { username: true, avatar: true } },
            category: { select: { name: true, slug: true } },
        },
    });

    const categories = await prisma.blogCategory.findMany({
        include: {
            _count: { select: { articles: true } },
        },
    });

    return { articles, categories };
}

export default async function BlogPage() {
    const { articles, categories } = await getBlogArticles();

    return (
        <div className="min-h-screen flex flex-col">
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
                                    <span className="text-gray-700">Blog</span>
                                </div>

                                <h1 className="text-3xl font-bold text-gray-900 mb-8">Blog</h1>

                                {articles.length === 0 ? (
                                    <div className="bg-white rounded-xl p-12 text-center">
                                        <p className="text-gray-500">No articles published yet.</p>
                                    </div>
                                ) : (
                                    <ThemeSlot
                                        name="NewsGrid"
                                        defaultComponent={<NewsGrid posts={articles} />}
                                        props={{ posts: articles }}
                                    />
                                )}
                            </div>
                        ),
                        sidebar: (
                            <aside className="space-y-6">
                                {/* Categories */}
                                <div className="bg-white rounded-xl border border-gray-100 p-5">
                                    <h3 className="font-bold text-gray-900 mb-4">Categories</h3>
                                    <div className="space-y-2">
                                        {categories.map((category) => (
                                            <Link
                                                key={category.id}
                                                href={`/blog/category/${category.slug}`}
                                                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                <span className="text-gray-700">{category.name}</span>
                                                <span className="text-sm text-gray-500">
                                                    {category._count.articles}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Posts */}
                                <div className="bg-white rounded-xl border border-gray-100 p-5">
                                    <h3 className="font-bold text-gray-900 mb-4">Recent Posts</h3>
                                    <div className="space-y-4">
                                        {articles.slice(0, 5).map((article) => (
                                            <Link
                                                key={article.id}
                                                href={`/blog/${article.number}/${article.slug}`}
                                                className="block group"
                                            >
                                                <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                                                    {article.title}
                                                </h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {formatDate(article.publishedAt || article.createdAt)}
                                                </p>
                                            </Link>
                                        ))}
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
