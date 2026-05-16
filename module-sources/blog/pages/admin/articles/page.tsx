import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { formatDate } from "@/core/lib/utils";
import { getTranslations } from "next-intl/server";


export const dynamic = "force-dynamic";

async function getBlogArticles() {
    const articles = await prisma.blogArticle.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            author: { select: { username: true } },
            category: { select: { name: true } },
        },
    });

    const stats = await prisma.blogArticle.groupBy({
        by: ["status"],
        _count: true,
    });

    return { articles, stats };
}

export default async function AdminBlogArticlesPage() {
    const t = await getTranslations("blog");
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        redirect("/");
    }

    const { articles, stats } = await getBlogArticles();

    const draftCount = stats.find(s => s.status === "DRAFT")?._count || 0;
    const publishedCount = stats.find(s => s.status === "PUBLISHED")?._count || 0;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_blogArticles")}</h1>
                    <p className="text-muted-foreground">{t("adm_manageBlogContent")}</p>
                </div>
                <Link href="/admin/blog/articles/new">
                    <Button>{`+ ${t("adm_newArticle")}`}</Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t("adm_totalArticles")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{articles.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t("adm_published")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">{publishedCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t("adm_drafts")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">{draftCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Articles Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("adm_allArticles")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {articles.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {t("adm_noArticlesYet")}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium">{t("adm_titleCol")}</th>
                                        <th className="text-left py-3 px-4 font-medium">{t("adm_category")}</th>
                                        <th className="text-left py-3 px-4 font-medium">{t("adm_author")}</th>
                                        <th className="text-left py-3 px-4 font-medium">{t("adm_status")}</th>
                                        <th className="text-left py-3 px-4 font-medium">{t("adm_views")}</th>
                                        <th className="text-left py-3 px-4 font-medium">{t("adm_date")}</th>
                                        <th className="text-right py-3 px-4 font-medium">{t("adm_actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {articles.map((article) => (
                                        <tr key={article.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <div>
                                                    <p className="font-medium">{article.title}</p>
                                                    <p className="text-sm text-muted-foreground">/{article.slug}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm">
                                                    {article.category?.name || "-"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm">{article.author?.username ?? "—"}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span
                                                    className={`text-xs px-2 py-1 rounded ${article.status === "PUBLISHED"
                                                        ? "bg-success/20 text-success"
                                                        : article.status === "DRAFT"
                                                            ? "bg-warning/20 text-warning"
                                                            : "bg-muted text-muted-foreground"
                                                        }`}
                                                >
                                                    {article.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm">{article.views}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDate(article.createdAt)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Link
                                                    href={`/admin/blog/articles/${article.id}/edit`}
                                                    className="text-primary hover:underline text-sm mr-3"
                                                >
                                                    {t("adm_edit")}
                                                </Link>
                                                <Link
                                                    href={`/blog/${article.number}/${article.slug}`}
                                                    target="_blank"
                                                    className="text-muted-foreground hover:underline text-sm"
                                                >
                                                    {t("adm_view")}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
