"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatCurrency } from "@/core/lib/utils";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number | null;
    image: string | null;
    isActive: boolean;
    isFeatured: boolean;
    category: { name: string } | null;
    _count: { orderItems: number };
}

export default function AdminProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/store/products?page=${page}&limit=20&all=true`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
                setTotal(data.pagination?.total || data.total || 0);
                setTotalPages(data.pagination?.pages || data.pages || 1);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [page]);

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Products</h1>
                    <p className="text-muted-foreground">{total} products total</p>
                </div>
                <Link href="/admin/store/products/new">
                    <Button>+ Add Product</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Products</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-4xl mb-4 block">���</span>
                            <p className="text-muted-foreground">No products yet</p>
                            <Link href="/admin/store/products/new">
                                <Button className="mt-4">Create Your First Product</Button>
                            </Link>
                        </div>
                    ) : (
                        <>
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
                                                    {product._count?.orderItems || 0}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`text-xs px-2 py-1 rounded ${product.isActive
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                        {product.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                    {product.isFeatured && (
                                                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 ml-1">
                                                            Featured
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Link href={`/admin/store/products/${product.id}/edit`}>
                                                        <Button variant="ghost" size="sm">Edit</Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {page} of {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
