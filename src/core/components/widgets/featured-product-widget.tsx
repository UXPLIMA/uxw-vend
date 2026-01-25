
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { useCurrency } from "@/core/lib/currency/context";

// Sample data for now, ideally passed as props or fetched
const featuredProduct = {
    name: "Legend Rank",
    price: 49.99,
    image: "👑",
};

export function FeaturedProductWidget() {
    const sidebarT = useTranslations('sidebar');
    const storeT = useTranslations('store');
    const { formatPrice } = useCurrency();

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">{sidebarT('featuredProduct')}</h3>
            <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-4xl">{featuredProduct.image}</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{featuredProduct.name}</h4>
                <p className="text-blue-600 font-bold text-lg mb-3">{formatPrice(featuredProduct.price)}</p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-none">
                    {storeT('addToCart')}
                </Button>
            </div>
        </div>
    );
}
