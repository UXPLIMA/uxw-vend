import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatCurrency } from "@/core/lib/utils";


export const dynamic = "force-dynamic";


async function getProducts(page: number = 1, limit: number = 20) {
    const [products, total] = await Promise.all([
        prisma.product.findMany({
            include: {
                category: { select: { name: true } },
                _count: { select: { orderItems: true } },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.product.count(),
    ]);

    return { products, total, pages: Math.ceil(total / limit) };
}

export default async function AdminProductsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        redirect("/");
    }

    const { products, total } = await getProducts();

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Products</h1>
                    <p className="text-muted-foreground">{total} products total</p>
                </div>
                <Button>+ Add Product</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Products</CardTitle>
                </CardHeader>
                <CardContent>
                    {products.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-4xl mb-4 block">📦</span>
                            <p className="text-muted-foreground">No products yet</p>
                            <Button className="mt-4">Create Your First Product</Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Price</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sales</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <tr key={product.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                                        {product.image ? (
                                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground">{product.slug}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {product.category?.name || "-"}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {formatCurrency(Number(product.price))}
                                            </td>
                                            <td className="py-3 px-4">
                                                {product.stock === null ? "∞" : product.stock}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {product._count.orderItems}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`text-xs px-2 py-1 rounded ${product.isActive
                                                    ? "bg-success/20 text-success"
                                                    : "bg-muted text-muted-foreground"
                                                    }`}>
                                                    {product.isActive ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button variant="ghost" size="sm">Edit</Button>
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
