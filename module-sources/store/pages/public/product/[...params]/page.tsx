"use client";

import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { Link } from "@/core/lib/i18n/navigation";
import { useParams } from "next/navigation";
import { useRouter } from "@/core/lib/i18n/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { useCurrency } from "../../../../lib/currency-context";
import { useTranslations } from "next-intl";

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
    const { formatPrice } = useCurrency();
    const t = useTranslations('store');

    // URL: /store/product/5/legendary-key
    // useParams returns { slug: ["store", "product", "5", "legendary-key"], locale: "tr" } or { params: ["5", "legendary-key"] }
    const rawParams = params.params || params.slug;
    const segments = Array.isArray(rawParams) ? rawParams : [rawParams];
    // If coming through [...slug] catch-all, segments = ["store", "product", "5", "legendary-key"]
    // Find the number segment (first numeric after "product")
    const productIdx = segments.indexOf("product");
    const lookupId = productIdx >= 0 && segments[productIdx + 1] ? segments[productIdx + 1] : segments[0];


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
        fetch(`/api/v1/store/products/${lookupId}`)
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
    }, [lookupId]);

    // Fetch product variables
    useEffect(() => {
        if (!product) return;
        fetch(`/api/v1/product-variables?productId=${product.id}`)
            .then((r) => r.json())
            .then((d) => setVariables(d.variables || []))
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                toast.success(`${product.name} added to cart`);
                setTimeout(() => setAddedToCart(false), 2000);
            } else {
                toast.error("Failed to add to cart");
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
            <div className="min-h-screen flex flex-col bg-muted">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </main>
                <ThemeSlot name="Footer" defaultComponent={<Footer />} />
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex flex-col bg-muted">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-foreground mb-4">{t('productNotFound')}</h1>
                        <Link href="/store">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                {t('backToStore')}
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
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Link href="/store" className="hover:text-blue-600 flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" />
                        {t('backToStore')}
                    </Link>
                    <span>/</span>
                    <span className="text-foreground">{product.category.name}</span>
                    <span>/</span>
                    <span className="text-foreground font-medium">{product.name}</span>
                </div>

                {/* Product Layout */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Side - Image & Description */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Product Image Carousel */}
                        <div className="relative bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
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
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 hover:bg-card flex items-center justify-center shadow-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-foreground" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 hover:bg-card flex items-center justify-center shadow-lg transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 text-foreground" />
                                    </button>
                                </>
                            )}

                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    {images.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentImageIndex(index)}
                                            className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-card' : 'bg-card/50'}`}
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
                                        className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${index === currentImageIndex ? 'border-blue-600' : 'border-border hover:border-border'}`}
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
                        <div className="bg-card rounded-lg border border-border p-6">
                            <h1 className="text-2xl font-bold text-foreground mb-2">{product.name}</h1>
                            {product.description && (
                                <div
                                    className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right Side - Payment Box */}
                    <div className="lg:col-span-1">
                        <div className="bg-card rounded-lg border border-border p-6 sticky top-24">
                            {/* Price */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-2">
                                    {product.comparePrice && (
                                        <span className="text-lg text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
                                    )}
                                    <span className="text-3xl font-bold text-foreground">{formatPrice(product.price)}</span>
                                </div>
                                {product.comparePrice && (
                                    <div className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded mt-2">
                                        {t('save', { amount: formatPrice(product.comparePrice - product.price) })}
                                    </div>
                                )}
                            </div>

                            {/* Stock */}
                            <div className="flex items-center gap-2 text-sm mb-4">
                                <div className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-muted-foreground">{inStock ? t('inStock') : t('outOfStock')}</span>
                                {product.stock !== null && inStock && (
                                    <span className="text-muted-foreground">({t('available', { count: product.stock })})</span>
                                )}
                            </div>

                            {/* Quantity */}
                            {inStock && (
                                <div className="mb-4">
                                    <label className="text-sm font-medium text-foreground mb-2 block">{t('quantity')}</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-lg font-medium text-foreground w-12 text-center">{quantity}</span>
                                        <button
                                            onClick={() => setQuantity(Math.min(maxStock, quantity + 1))}
                                            className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
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
                                            <label className="text-sm font-medium text-foreground mb-1 block">
                                                {v.label} {v.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {v.type === "select" && v.options ? (
                                                <select
                                                    value={variableValues[v.name] || ""}
                                                    onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
                                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                                    required={v.required}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Total */}
                            <div className="border-t border-border pt-4 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">{t('total')}</span>
                                    <span className="text-xl font-bold text-foreground">{formatPrice(totalPrice)}</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm"
                                    onClick={buyNow}
                                    disabled={!inStock || addingToCart}
                                >
                                    {addingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : t('buyNow')}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-border text-foreground hover:bg-muted rounded-sm"
                                    onClick={addToCart}
                                    disabled={!inStock || addingToCart}
                                >
                                    {addedToCart ? (
                                        <><Check className="w-4 h-4 mr-1" /> {t('addedToCart')}</>
                                    ) : (
                                        t('addToCart')
                                    )}
                                </Button>
                            </div>

                            {/* Category */}
                            <div className="mt-4 pt-4 border-t border-border">
                                <div className="text-xs text-muted-foreground">
                                    {t('category')}: <span className="text-foreground">{product.category.name}</span>
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
