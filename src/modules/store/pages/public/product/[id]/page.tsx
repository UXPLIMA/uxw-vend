"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { formatCurrency } from "@/core/lib/utils";

// Demo products data
const productsData: Record<string, {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    description: string;
    longDescription: string;
    images: string[];
    category: string;
    stock: number;
    features: string[];
}> = {
    "1": {
        id: "1",
        name: "VIP Key",
        price: 4.99,
        description: "Unlock exclusive VIP features with this special key.",
        longDescription: "The VIP Key grants you access to exclusive server features including special chat colors, priority queue access, and unique cosmetic items. This key is permanent and linked to your account once redeemed. Perfect for players who want to support the server while enjoying premium benefits.",
        images: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
        category: "Keys",
        stock: 150,
        features: [
            "Permanent unlock",
            "Priority queue access",
            "Special chat colors",
            "Unique cosmetics",
            "VIP-only areas access"
        ]
    },
    "2": {
        id: "2",
        name: "Premium Key",
        price: 9.99,
        originalPrice: 14.99,
        description: "Premium tier key with enhanced benefits.",
        longDescription: "The Premium Key takes your gaming experience to the next level. Get access to premium-only game modes, exclusive items, and enhanced features. This upgrade includes everything from VIP plus additional perks like custom join messages and extended warps.",
        images: ["/placeholder.svg", "/placeholder.svg"],
        category: "Keys",
        stock: 75,
        features: [
            "All VIP features included",
            "Premium game modes access",
            "Custom join messages",
            "Extended warps (10 instead of 5)",
            "Monthly exclusive items"
        ]
    },
    "3": {
        id: "3",
        name: "Money Key",
        price: 4.99,
        description: "Get in-game currency instantly.",
        longDescription: "The Money Key provides you with a generous amount of in-game currency to kickstart your adventure or expand your empire. Perfect for new players who want to get ahead or veterans looking to invest in new projects.",
        images: ["/placeholder.svg"],
        category: "Keys",
        stock: 200,
        features: [
            "Instant delivery",
            "100,000 in-game coins",
            "No expiration",
            "Safe transaction",
            "Can be gifted to others"
        ]
    }
};

export default function ProductDetailPage() {
    const params = useParams();
    const productId = params.id as string;
    const product = productsData[productId];
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    if (!product) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
                    <Link href="/store">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            Back to Store
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const totalPrice = product.price * quantity;

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            {/* Shared Hero Banner */}
            <HeroBanner />

            {/* Shared Navbar */}
            <Navbar />

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Link href="/store" className="hover:text-blue-600 flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Store
                    </Link>
                    <span>/</span>
                    <span className="text-gray-700">{product.category}</span>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">{product.name}</span>
                </div>

                {/* Product Layout */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Side - Image & Description */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Product Image Carousel - 16:9 Ratio */}
                        <div className="relative bg-gray-200 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                            <Image
                                src={product.images[currentImageIndex]}
                                alt={`${product.name} - Image ${currentImageIndex + 1}`}
                                fill
                                className="object-cover"
                            />

                            {/* Navigation Arrows */}
                            {product.images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 text-gray-700" />
                                    </button>
                                </>
                            )}

                            {/* Image Indicators */}
                            {product.images.length > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    {product.images.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentImageIndex(index)}
                                            className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Image Counter */}
                            <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                                {currentImageIndex + 1} / {product.images.length}
                            </div>
                        </div>

                        {/* Thumbnail Strip */}
                        {product.images.length > 1 && (
                            <div className="flex gap-3">
                                {product.images.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentImageIndex(index)}
                                        className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${index === currentImageIndex ? 'border-blue-600' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Image
                                            src={img}
                                            alt={`Thumbnail ${index + 1}`}
                                            fill
                                            className="object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Product Info */}
                        <div className="bg-white rounded-lg border border-gray-100 p-6">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
                            <p className="text-gray-600 mb-4">{product.description}</p>

                            <div className="border-t border-gray-100 pt-4 mt-4">
                                <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
                                <p className="text-gray-600 leading-relaxed">{product.longDescription}</p>
                            </div>

                            <div className="border-t border-gray-100 pt-4 mt-4">
                                <h2 className="text-lg font-semibold text-gray-900 mb-3">Features</h2>
                                <ul className="space-y-2">
                                    {product.features.map((feature, index) => (
                                        <li key={index} className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-4 h-4 text-green-500" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Payment Box */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg border border-gray-100 p-6 sticky top-24">
                            {/* Price */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-2">
                                    {product.originalPrice && (
                                        <span className="text-lg text-gray-400 line-through">{formatCurrency(product.originalPrice)}</span>
                                    )}
                                    <span className="text-3xl font-bold text-gray-900">{formatCurrency(product.price)}</span>
                                </div>
                                {product.originalPrice && (
                                    <div className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded mt-2">
                                        Save {formatCurrency(product.originalPrice - product.price)}
                                    </div>
                                )}
                            </div>

                            {/* Stock */}
                            <div className="flex items-center gap-2 text-sm mb-4">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-gray-600">In Stock</span>
                                <span className="text-gray-400">({product.stock} available)</span>
                            </div>

                            {/* Quantity */}
                            <div className="mb-4">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Quantity</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="text-lg font-medium text-gray-900 w-12 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                                        className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="border-t border-gray-100 pt-4 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total</span>
                                    <span className="text-xl font-bold text-gray-900">{formatCurrency(totalPrice)}</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm">
                                    Buy Now
                                </Button>
                                <Button variant="outline" className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-sm">
                                    Add to Cart
                                </Button>
                            </div>

                            {/* Category */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="text-xs text-gray-500">
                                    Category: <span className="text-gray-700">{product.category}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Shared Footer */}
            <Footer />
        </div>
    );
}
