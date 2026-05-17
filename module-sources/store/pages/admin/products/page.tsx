"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatCurrency } from "@/core/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, Package } from "lucide-react";

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
    const t = useTranslations("store");
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

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        fetchProducts();
    }, [page]);
    /* eslint-enable react-hooks/exhaustive-deps */

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_products")}</h1>
                    <p className="text-muted-foreground">{t("adm_productsTotal", { count: total })}</p>
                </div>
                <Link href="/admin/store/products/new">
                    <Button>{`+ ${t("adm_addProduct")}`}</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("adm_allProducts")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                            <p className="text-muted-foreground">{t("adm_noProductsYet")}</p>
                            <Link href="/admin/store/products/new">
                                <Button className="mt-4">{t("adm_createFirstProduct")}</Button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_product")}</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_category")}</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_price")}</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_stock")}</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_sales")}</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_status")}</th>
                                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("adm_actions")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((product) => (
                                            <tr key={product.id} className="hover:bg-muted/50">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                                            {product.image ? (
                                                                <Image src={product.image} alt={product.name} width={40} height={40} className="w-full h-full object-cover" />
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
                                                        : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {product.isActive ? t("adm_active") : t("adm_inactive")}
                                                    </span>
                                                    {product.isFeatured && (
                                                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 ml-1">
                                                            {t("adm_featured")}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Link href={`/admin/store/products/${product.id}/edit`}>
                                                        <Button variant="ghost" size="sm">{t("adm_edit")}</Button>
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
                                        {t("adm_pageOf", { page, totalPages })}
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
