"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Check, X, Crown, Loader2 } from "lucide-react";
import { useCurrency } from "../../../lib/currency-context";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface Product {
    id: string;
    number: number;
    name: string;
    slug: string;
    price: number;
    comparePrice: number | null;
    description: string | null;
    image: string | null;
    isFeatured: boolean;
    category: { name: string } | null;
}

// Parse features from description - format: "feature1|feature2|feature3"
// or JSON array in deliveryData
function parseFeatures(product: Product): string[] {
    if (product.description) {
        // Try splitting by newlines or pipes
        const lines = product.description.split(/\n|\|/).map(s => s.trim()).filter(Boolean);
        if (lines.length > 1) return lines;
    }
    return [];
}

export default function VipTablePage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const { formatPrice } = useCurrency();

    useEffect(() => {
        // Fetch featured products to use as VIP ranks
        fetch("/api/v1/store/products?featured=true&limit=10")
            .then((r) => r.json())
            .then((data) => {
                setProducts(data.products || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-muted">
                <ThemeComponentSlot name="Hero" fallback={() => null} />
                <Navbar />
                <main className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </main>
                <Footer />
            </div>
        );
    }

    // Collect all unique features across products
    const allFeatures: string[] = [];
    const productFeatures = products.map((p) => {
        const features = parseFeatures(p);
        features.forEach((f) => {
            if (!allFeatures.includes(f)) allFeatures.push(f);
        });
        return { product: p, features };
    });

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" fallback={() => null} />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">VIP Ranks</h1>
                    <p className="text-muted-foreground">Compare ranks and choose the best one for you</p>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border">
                        <Crown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-muted-foreground">No VIP ranks available yet</p>
                    </div>
                ) : allFeatures.length > 0 ? (
                    /* Full comparison table when features are available */
                    <div className="bg-card rounded-xl border overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-4 px-6 font-medium text-muted-foreground min-w-[200px]">Feature</th>
                                    {productFeatures.map(({ product }) => (
                                        <th key={product.id} className="text-center py-4 px-4 min-w-[150px]">
                                            <div className="flex flex-col items-center gap-1">
                                                {product.image ? (
                                                    <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover" /></>
                                                ) : (
                                                    <Crown className="w-8 h-8 text-yellow-500" />
                                                )}
                                                <span className="font-bold text-foreground">{product.name}</span>
                                                <div>
                                                    {product.comparePrice && (
                                                        <span className="text-xs text-muted-foreground line-through mr-1">{formatPrice(product.comparePrice)}</span>
                                                    )}
                                                    <span className="text-blue-600 font-bold">{formatPrice(product.price)}</span>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {allFeatures.map((feature, i) => (
                                    <tr key={i} className={i % 2 === 0 ? "bg-muted" : ""}>
                                        <td className="py-3 px-6 text-sm text-foreground">{feature}</td>
                                        {productFeatures.map(({ product, features }) => (
                                            <td key={product.id} className="text-center py-3 px-4">
                                                {features.includes(feature) ? (
                                                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                                                ) : (
                                                    <X className="w-5 h-5 text-gray-300 mx-auto" />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t">
                                    <td className="py-4 px-6"></td>
                                    {productFeatures.map(({ product }) => (
                                        <td key={product.id} className="text-center py-4 px-4">
                                            <Link href={`/store/product/${product.number}/${product.slug}`}>
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                                    Buy Now
                                                </Button>
                                            </Link>
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    /* Card layout when no feature comparison */
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map((product, i) => (
                            <div
                                key={product.id}
                                className={`bg-card rounded-xl border p-6 text-center relative ${i === Math.floor(products.length / 2) ? "ring-2 ring-blue-500 scale-105" : ""}`}
                            >
                                {i === Math.floor(products.length / 2) && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                                        POPULAR
                                    </div>
                                )}
                                {product.image ? (
                                    <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={product.image} alt="" className="w-16 h-16 rounded-lg object-cover mx-auto mb-3" /></>
                                ) : (
                                    <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                                )}
                                <h3 className="text-xl font-bold text-foreground mb-1">{product.name}</h3>
                                <div className="mb-4">
                                    {product.comparePrice && (
                                        <span className="text-muted-foreground line-through text-sm mr-2">{formatPrice(product.comparePrice)}</span>
                                    )}
                                    <span className="text-2xl font-bold text-blue-600">{formatPrice(product.price)}</span>
                                </div>
                                {product.description && (
                                    <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
                                )}
                                <Link href={`/store/product/${product.number}/${product.slug}`}>
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                        Buy Now
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
