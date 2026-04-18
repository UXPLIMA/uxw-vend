"use client";

import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { Link } from "@/core/lib/i18n/navigation";
import { Coins, Box, ChevronRight, Search, X } from "lucide-react";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { SkeletonServerModes, SkeletonProductGrid } from "../../components/skeletons/store-skeletons";
import { useTranslations } from "next-intl";
import { useCurrency } from "../../lib/currency-context";
interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    parentId: string | null;
    children?: Category[];
}

interface Product {
    id: string;
    number: number;
    name: string;
    slug: string;
    price: number;
    comparePrice: number | null;
    image: string | null;
    stock: number;
    isFeatured: boolean;
    category: { slug: string; name: string };
    type: string;
}

export default function StorePage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeMode, setActiveMode] = useState<string | null>(null); // slug of root category
    const [activeCategory, setActiveCategory] = useState<string | null>(null); // slug of sub category

    const [products, setProducts] = useState<Product[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [sortBy, setSortBy] = useState("newest");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Product[] | null>(null);
    const [searching, setSearching] = useState(false);

    const t = useTranslations('store');
    const commonT = useTranslations('common');
    const { formatPrice } = useCurrency();

    // Fetch Categories
    useEffect(() => {
        fetch("/api/v1/store/categories")
            .then((res) => res.json())
            .then((data) => {
                setCategories(data.categories || []);
                setLoadingCategories(false);
            })
            .catch(() => setLoadingCategories(false));
    }, []);

    // Fetch Products when category changes
    useEffect(() => {
        const categorySlug = activeCategory || activeMode;
        if (categorySlug) {
            setLoadingProducts(true);
            fetch(`/api/v1/store/products?category=${categorySlug}&limit=12&sort=${sortBy}`)
                .then((res) => res.json())
                .then((data) => {
                    setProducts(data.products || []);
                    setLoadingProducts(false);
                })
                .catch(() => setLoadingProducts(false));
        } else {
            setProducts([]);
        }
    }, [activeCategory, activeMode, sortBy]);

    // Derived state
    const rootCategories = categories.filter((c) => c.parentId === null);
    const activeRootCategory = categories.find((c) => c.slug === activeMode);
    const subCategories = activeRootCategory?.children || [];

    const showModes = !activeMode && !activeCategory;
    const showSubCategories = activeMode && !activeCategory;
    const showProducts = activeCategory !== null || (activeMode !== null && subCategories.length === 0);

    const resetView = () => {
        setActiveMode(null);
        setActiveCategory(null);
        setProducts([]);
        setSearchResults(null);
        setSearchQuery("");
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`/api/v1/store/products?search=${encodeURIComponent(searchQuery)}&limit=20`);
            const data = await res.json();
            setSearchResults(data.products || []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery("");
        setSearchResults(null);
    };

    const handleModeSelect = (slug: string) => {
        setActiveMode(slug);
        setActiveCategory(null);
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            {/* Shared Hero Banner */}
            <HeroBanner />

            {/* Shared Navbar */}
            <Navbar />

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
                    <button onClick={resetView} className="hover:text-blue-600">{commonT('home')}</button>
                    <ChevronRight className="w-4 h-4" />
                    <button onClick={resetView} className="hover:text-blue-600">{t('title')}</button>

                    {activeMode && (
                        <>
                            <ChevronRight className="w-4 h-4" />
                            <span className={`text-foreground capitalize ${activeCategory ? "cursor-pointer hover:text-blue-600" : ""}`} onClick={() => setActiveCategory(null)}>
                                {activeRootCategory?.name || activeMode}
                            </span>
                        </>
                    )}
                    {activeCategory && (
                        <>
                            <ChevronRight className="w-4 h-4" />
                            <span className="text-foreground capitalize">
                                {categories.find(c => c.slug === activeCategory)?.name || activeCategory}
                            </span>
                        </>
                    )}
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="mb-6">
                    <div className="relative max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('searchProducts')}
                            className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-muted-foreground hover:text-muted-foreground" />
                            </button>
                        )}
                    </div>
                </form>

                {/* Search Results */}
                {searchResults !== null && (
                    <section className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">
                                {searching ? t('searching') : t('searchResultsFor', { query: searchQuery, count: searchResults.length })}
                            </h2>
                            <button onClick={clearSearch} className="text-sm text-blue-600 hover:underline">{t('clear')}</button>
                        </div>
                        {!searching && searchResults.length === 0 ? (
                            <div className="bg-card rounded-xl p-8 text-center border border-border">
                                <p className="text-muted-foreground">{t('noProductsSearch')}</p>
                            </div>
                        ) : !searching ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {searchResults.map((product) => (
                                    <Link
                                        key={product.id}
                                        href={`/store/product/${product.number}/${product.slug}`}
                                        className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-all group"
                                    >
                                        <div className="h-44 bg-muted flex items-center justify-center overflow-hidden">
                                            {product.image ? (
                                                <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></>
                                            ) : (
                                                <Box className="w-16 h-16 text-gray-300" />
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{product.name}</h3>
                                            <div className="text-blue-600 font-bold">{formatPrice(product.price)}</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : null}
                    </section>
                )}

                {/* Root Categories (Server Modes) */}
                {showModes && (
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-6">{t('title')}</h2>
                        {loadingCategories ? (
                            <SkeletonServerModes />
                        ) : rootCategories.length === 0 ? (
                            <div className="text-center py-12 bg-card rounded-xl">
                                <p className="text-muted-foreground">{t('noCategories')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                {rootCategories.map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => handleModeSelect(mode.slug)}
                                        className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-all group text-left"
                                    >
                                        <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
                                            {mode.image ? (
                                                <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={mode.image} alt={mode.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></>
                                            ) : (
                                                <Box className="w-12 h-12 text-gray-300" />
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold text-foreground">{mode.name}</h3>
                                            {mode.description && (
                                                <div
                                                    className="text-sm text-muted-foreground mt-1 prose prose-sm max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mode.description) }}
                                                />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Sub Categories */}
                {showSubCategories && (
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">{activeRootCategory?.name} - {t('categories')}</h2>
                        </div>

                        {subCategories.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
                                {subCategories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.slug)}
                                        className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-all group text-left"
                                    >
                                        <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
                                            {cat.image ? (
                                                <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></>
                                            ) : (
                                                <Coins className="w-12 h-12 text-gray-300" />
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-medium text-foreground">{cat.name}</h3>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">{t('noSubCategories')}</p>
                                {/* If no sub-categories, we likely want to show products directly. 
                                    The logic `showProducts = ... || (activeMode && subCategories.length === 0)` handles this below. 
                                */}
                            </div>
                        )}
                    </section>
                )}

                {/* Products Grid */}
                {(showProducts || (activeMode && subCategories.length === 0)) && (
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground">{t('products')}</h2>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card"
                            >
                                <option value="newest">{t('newest')}</option>
                                <option value="price_asc">{t('priceLowHigh')}</option>
                                <option value="price_desc">{t('priceHighLow')}</option>
                                <option value="popular">{t('mostPopular')}</option>
                            </select>
                        </div>
                        {loadingProducts ? (
                            <SkeletonProductGrid count={4} />
                        ) : products.length === 0 ? (
                            <div className="bg-card rounded-xl p-8 text-center border border-border">
                                <p className="text-muted-foreground">{t('noProducts')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {products.map((product) => (
                                    <Link
                                        key={product.id}
                                        href={`/store/product/${product.number}/${product.slug}`}
                                        className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-all group"
                                    >
                                        <div className={`h-44 bg-muted flex items-center justify-center overflow-hidden relative`}>
                                            {product.isFeatured && (
                                                <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full z-10">
                                                    {t('featured')}
                                                </span>
                                            )}
                                            {product.image ? (
                                                <>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                                </>
                                            ) : (
                                                <Box className="w-16 h-16 text-gray-300" />
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{product.name}</h3>
                                            <div className="flex items-center gap-2 mb-3">
                                                {product.comparePrice && (
                                                    <span className="line-through text-muted-foreground text-xs">{formatPrice(product.comparePrice)}</span>
                                                )}
                                                <div className="text-blue-600 font-bold">{formatPrice(product.price)}</div>
                                            </div>
                                            <div className="text-sm text-muted-foreground group-hover:text-blue-600 transition-colors">
                                                {t('viewDetails')} →
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* Shared Footer */}
            <Footer />
        </div>
    );
}
