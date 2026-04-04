"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { useCurrency } from "@/core/lib/currency/context";
import { Link } from "@/core/lib/i18n/navigation";

interface Product {
    id: string;
    number: number;
    name: string;
    slug: string;
    price: number;
    image: string | null;
}

export function FeaturedProductWidget() {
    const sidebarT = useTranslations('sidebar');
    const storeT = useTranslations('store');
    const { formatPrice } = useCurrency();
    const [product, setProduct] = useState<Product | null>(null);

    useEffect(() => {
        fetch("/api/v1/store/products?featured=true&limit=1")
            .then((res) => res.json())
            .then((data) => {
                const products = data.products || [];
                if (products.length > 0) setProduct(products[0]);
            })
            .catch(() => {});
    }, []);

    if (!product) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">{sidebarT('featuredProduct')}</h3>
            <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 bg-amber-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-4xl">👑</span>
                    )}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{product.name}</h4>
                <p className="text-blue-600 font-bold text-lg mb-3">{formatPrice(product.price)}</p>
                <Link href={`/store/product/${product.number}/${product.slug}`}>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-none">
                        {storeT('viewDetails')}
                    </Button>
                </Link>
            </div>
        </div>
    );
}
