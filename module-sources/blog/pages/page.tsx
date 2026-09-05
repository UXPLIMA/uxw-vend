import { formatDate } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";
import { Link } from "@/core/sdk/navigation";
import { Footer, Navbar, StandardSidebarLayout } from "@/core/sdk/layout";
import { ThemeComponentSlot } from "@/core/sdk/theme";
import { NewsGrid } from "../components/news-grid";
import { getTranslations, getLocale } from "next-intl/server";
import { dateLocaleTag } from "@/core/sdk";

export const revalidate = 60;

/**
 * One page of articles.
 *
 * The index used to read every published article, with its author and its
 * category joined, and render all of them into one grid. That is the whole
 * table on every visit, and it grows for the life of the site while the page
 * only ever shows a screenful.
 */
const PER_PAGE = 12;

interface Filter {
    category?: string;
    tag?: string;
}

/**
 * The sidebar has always listed the categories, and every article has always
 * shown its category and its tags as links. All of them pointed at
 * `/blog/category/<slug>` and `/blog/tag/<slug>`, which no route serves: the
 * `[...params]` catch-all reads the segment after `blog` as an article lookup,
 * so every one of those links looked up an article called "category" and
 * answered 404. The whole of the blog's browsing was dead.
 *
 * One grid can do the job, so the filter is a query parameter on this page
 * rather than two more routes, and paging keeps it.
 */
async function getBlogArticles(page: number, filter: Filter) {
    const where = {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        ...(filter.category ? { category: { slug: filter.category } } : {}),
        ...(filter.tag ? { tags: { some: { slug: filter.tag } } } : {}),
    } as const;

    const [articles, total, categories, recent, activeCategory, activeTag] = await Promise.all([
        prisma.blogArticle.findMany({
            where,
            orderBy: { publishedAt: "desc" },
            skip: (page - 1) * PER_PAGE,
            take: PER_PAGE,
            include: {
                author: { select: { username: true, avatar: true } },
                category: { select: { name: true, slug: true } },
            },
        }),
        prisma.blogArticle.count({ where }),
        prisma.blogCategory.findMany({
            include: {
                _count: { select: { articles: true } },
            },
        }),
        // The sidebar wants the five newest on every page, not the five that
        // happen to be at the top of the page being viewed.
        prisma.blogArticle.findMany({
            where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
            orderBy: { publishedAt: "desc" },
            take: 5,
            select: { id: true, number: true, slug: true, title: true, publishedAt: true, createdAt: true },
        }),
        filter.category
            ? prisma.blogCategory.findUnique({ where: { slug: filter.category }, select: { name: true } })
            : Promise.resolve(null),
        filter.tag
            ? prisma.blogTag.findUnique({ where: { slug: filter.tag }, select: { name: true } })
            : Promise.resolve(null),
    ]);

    return {
        articles,
        categories,
        recent,
        pages: Math.max(1, Math.ceil(total / PER_PAGE)),
        activeName: activeCategory?.name ?? activeTag?.name ?? null,
    };
}

/** `/blog`, with the filter and the page kept in the query string. */
function blogHref(filter: Filter, page?: number): string {
    const query = new URLSearchParams();
    if (filter.category) query.set("category", filter.category);
    if (filter.tag) query.set("tag", filter.tag);
    if (page && page > 1) query.set("page", String(page));
    const qs = query.toString();
    return qs ? `/blog?${qs}` : "/blog";
}

interface BlogPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined): string | undefined => {
    const value = Array.isArray(v) ? v[0] : v;
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
    const query = (await searchParams) ?? {};
    const requested = Number.parseInt(one(query.page) ?? "", 10);
    const page = Number.isFinite(requested) && requested > 0 ? requested : 1;
    const filter: Filter = { category: one(query.category), tag: one(query.tag) };
    const { articles, categories, recent, pages, activeName } = await getBlogArticles(page, filter);
    const t = await getTranslations('blog');
    const dateTag = dateLocaleTag(await getLocale());
    const commonT = await getTranslations('common');

    return (
        <div className="min-h-screen flex flex-col">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                <StandardSidebarLayout sidebar={(
                            <aside className="space-y-6">
                                {/* Categories */}
                                <div className="bg-card rounded-xl border border-border p-5">
                                    <h2 className="font-bold text-foreground mb-4">{t('categories')}</h2>
                                    <div className="space-y-2">
                                        {categories.map((category) => (
                                            <Link
                                                key={category.id}
                                                href={blogHref({ category: category.slug })}
                                                aria-current={filter.category === category.slug ? "page" : undefined}
                                                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${filter.category === category.slug ? "bg-muted font-medium" : "hover:bg-muted"}`}
                                            >
                                                <span className="text-foreground">{category.name}</span>
                                                <span className="text-sm text-muted-foreground">
                                                    {category._count.articles}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Posts */}
                                <div className="bg-card rounded-xl border border-border p-5">
                                    <h2 className="font-bold text-foreground mb-4">{t('recentPosts')}</h2>
                                    <div className="space-y-4">
                                        {recent.map((article) => (
                                            <Link
                                                key={article.id}
                                                href={`/blog/${article.number}/${article.slug}`}
                                                className="block group"
                                            >
                                                <h3 className="text-sm font-medium text-foreground group-hover:text-blue-600 transition-colors line-clamp-2">
                                                    {article.title}
                                                </h3>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDate(article.publishedAt || article.createdAt, undefined, dateTag)}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </aside>
                        )}>
                    {(
                            <div className="lg:col-span-3">
                                {/* Breadcrumb */}
                                <div className="text-sm text-muted-foreground mb-6">
                                    <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
                                    <span className="mx-2">/</span>
                                    {activeName ? (
                                        <>
                                            <Link href="/blog" className="hover:text-blue-600">{t('title')}</Link>
                                            <span className="mx-2">/</span>
                                            <span className="text-foreground">{activeName}</span>
                                        </>
                                    ) : (
                                        <span className="text-foreground">{t('title')}</span>
                                    )}
                                </div>

                                <h1 className="text-3xl font-bold text-foreground mb-2">{activeName ?? t('title')}</h1>
                                {(filter.category || filter.tag) && (
                                    <p className="mb-8 text-sm text-muted-foreground">
                                        <Link href="/blog" className="text-primary hover:underline">{t('allArticles')}</Link>
                                    </p>
                                )}
                                {!(filter.category || filter.tag) && <div className="mb-8" />}

                                {articles.length === 0 ? (
                                    <div className="bg-card rounded-xl p-12 text-center space-y-3">
                                        <p className="text-muted-foreground">{t('noArticles')}</p>
                                        {(filter.category || filter.tag) && (
                                            <Link href="/blog" className="text-sm text-primary hover:underline">{t('allArticles')}</Link>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <NewsGrid posts={articles} />
                                        {pages > 1 && (
                                            <nav className="flex items-center justify-between mt-8" aria-label={t('title')}>
                                                {page > 1 ? (
                                                    <Link href={blogHref(filter, page - 1)} className="text-sm text-primary hover:underline">
                                                        {commonT('previous')}
                                                    </Link>
                                                ) : <span />}
                                                <span className="text-sm text-muted-foreground">{page} / {pages}</span>
                                                {page < pages ? (
                                                    <Link href={blogHref(filter, page + 1)} className="text-sm text-primary hover:underline">
                                                        {commonT('next')}
                                                    </Link>
                                                ) : <span />}
                                            </nav>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                </StandardSidebarLayout>
            </main>

            <Footer />
        </div>
    );
}
