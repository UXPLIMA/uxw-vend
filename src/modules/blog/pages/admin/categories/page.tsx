import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";


export const dynamic = "force-dynamic";

async function getBlogCategories() {
    const categories = await prisma.blogCategory.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { articles: true } },
        },
    });
    return categories;
}

export default async function AdminBlogCategoriesPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        redirect("/");
    }

    const categories = await getBlogCategories();

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Blog Categories</h1>
                    <p className="text-muted-foreground">Organize your blog content</p>
                </div>
                <Link href="/admin/blog/categories/new">
                    <Button>+ New Category</Button>
                </Link>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">
                                No categories yet. Create your first category!
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    categories.map((category) => (
                        <Card key={category.id} className="transition-colors">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>{category.name}</span>
                                    <span className="text-sm font-normal text-muted-foreground">
                                        {category._count.articles} articles
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {category.description || "No description"}
                                </p>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/admin/blog/categories/${category.id}/edit`}
                                        className="text-primary hover:underline text-sm"
                                    >
                                        Edit
                                    </Link>
                                    <Link
                                        href={`/blog/category/${category.slug}`}
                                        target="_blank"
                                        className="text-muted-foreground hover:underline text-sm"
                                    >
                                        View
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </>
    );
}
