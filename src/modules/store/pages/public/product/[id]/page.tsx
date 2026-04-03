"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useParams } from "next/navigation";
import { useRouter } from "@/core/lib/i18n/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { useCurrency } from "@/core/lib/currency/context";

interface Product {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    comparePrice: number | null;
    image: string | null;
    images?: string[];
    stock: number | null;
    isActive: boolean;
    category: {
        id: string;
        name: string;
        slug: string;
    };
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;
    const { formatPrice } = useCurrency();

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [addingToCart, setAddingToCart] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const [variables, setVariables] = useState<{ name: string; label: string; type: string; required: boolean; placeholder?: string; options?: string }[]>([]);
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch(`/api/v1/store/products/${productId}`)
            .then((res) => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then((data) => {
                setProduct(data.product);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [productId]);

    // Fetch product variables
    useEffect(() => {
        if (!product) return;
        fetch(`/api/v1/product-variables?productId=${product.id}`)
            .then((r) => r.json())
            .then((d) => setVariables(d.variables || []))
            .catch(() => {});
    }, [product?.id]);

    const addToCart = async () => {
        if (!product) return;
        setAddingToCart(true);
        try {
            const res = await fetch("/api/v1/store/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id, quantity }),
            });
            if (res.ok) {
                setAddedToCart(true);
                setTimeout(() => setAddedToCart(false), 2000);
            }
        } catch (err) {
            console.error("Failed to add to cart:", err);
        } finally {
            setAddingToCart(false);
        }
    };

    const buyNow = async () => {
        if (!product) return;
        setAddingToCart(true);
        try {
            const res = await fetch("/api/v1/store/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id, quantity }),
            });
            if (res.ok) {
                router.push("/store/cart");
            }
        } catch (err) {
            console.error("Failed to add to cart:", err);
        } finally {
            setAddingToCart(false);
        }
    };

    // Build images array from product data
    const images = product?.images?.length
        ? product.images
        : product?.image
            ? [product.image]
            : ["/placeholder.svg"];

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-100">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </main>
                <ThemeSlot name="Footer" defaultComponent={<Footer />} />
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-100">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
                        <Link href="/store">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                Back to Store
                            </Button>
                        </Link>
                    </div>
                </main>
                <ThemeSlot name="Footer" defaultComponent={<Footer />} />
            </div>
        );
    }

    const maxStock = product.stock ?? 99;
    const totalPrice = product.price * quantity;
    const inStock = product.stock === null || product.stock > 0;

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Link href="/store" className="hover:text-blue-600 flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Store
                    </Link>
                    <span>/</span>
                    <span className="text-gray-700">{product.category.name}</span>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">{product.name}</span>
                </div>

                {/* Product Layout */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Side - Image & Description */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Product Image Carousel */}
                        <div className="relative bg-gray-200 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                            <Image
                                src={images[currentImageIndex]}
                                alt={`${product.name} - Image ${currentImageIndex + 1}`}
                                fill
                                className="object-cover"
                            />

                            {images.length > 1 && (
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

                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    {images.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentImageIndex(index)}
                                            className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                                {currentImageIndex + 1} / {images.length}
                            </div>
                        </div>

                        {/* Thumbnail Strip */}
                        {images.length > 1 && (
                            <div className="flex gap-3">
                                {images.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentImageIndex(index)}
                                        className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${index === currentImageIndex ? 'border-blue-600' : 'border-gray-200 hover:border-gray-300'}`}
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
                            {product.description && (
                                <p className="text-gray-600 leading-relaxed">{product.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Right Side - Payment Box */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg border border-gray-100 p-6 sticky top-24">
                            {/* Price */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-2">
                                    {product.comparePrice && (
                                        <span className="text-lg text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>
                                    )}
                                    <span className="text-3xl font-bold text-gray-900">{formatPrice(product.price)}</span>
                                </div>
                                {product.comparePrice && (
                                    <div className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded mt-2">
                                        Save {formatPrice(product.comparePrice - product.price)}
                                    </div>
                                )}
                            </div>

                            {/* Stock */}
                            <div className="flex items-center gap-2 text-sm mb-4">
                                <div className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-gray-600">{inStock ? 'In Stock' : 'Out of Stock'}</span>
                                {product.stock !== null && inStock && (
                                    <span className="text-gray-400">({product.stock} available)</span>
                                )}
                            </div>

                            {/* Quantity */}
                            {inStock && (
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
                                            onClick={() => setQuantity(Math.min(maxStock, quantity + 1))}
                                            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Product Variables */}
                            {variables.length > 0 && (
                                <div className="mb-4 space-y-3">
                                    {variables.map((v) => (
                                        <div key={v.name}>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                {v.label} {v.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {v.type === "select" && v.options ? (
                                                <select
                                                    value={variableValues[v.name] || ""}
                                                    onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                                    required={v.required}
                                                >
                                                    <option value="">Select...</option>
                                                    {v.options.split(",").map((opt) => (
                                                        <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={v.type || "text"}
                                                    value={variableValues[v.name] || ""}
                                                    onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                                                    placeholder={v.placeholder || v.label}
                                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                                    required={v.required}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Total */}
                            <div className="border-t border-gray-100 pt-4 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total</span>
                                    <span className="text-xl font-bold text-gray-900">{formatPrice(totalPrice)}</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm"
                                    onClick={buyNow}
                                    disabled={!inStock || addingToCart}
                                >
                                    {addingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy Now"}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-sm"
                                    onClick={addToCart}
                                    disabled={!inStock || addingToCart}
                                >
                                    {addedToCart ? (
                                        <><Check className="w-4 h-4 mr-1" /> Added</>
                                    ) : (
                                        "Add to Cart"
                                    )}
                                </Button>
                            </div>

                            {/* Category */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="text-xs text-gray-500">
                                    Category: <span className="text-gray-700">{product.category.name}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
