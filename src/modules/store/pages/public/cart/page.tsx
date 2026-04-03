"use client";

import { useEffect, useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useRouter } from "@/core/lib/i18n/navigation";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { useCurrency } from "@/core/lib/currency/context";
import { Loader2, Check, X } from "lucide-react";

interface CartItem {
    id: string;
    quantity: number;
    product: {
        id: string;
        name: string;
        slug: string;
        price: number;
        image: string | null;
        stock: number | null;
    };
}

interface CartData {
    items: CartItem[];
    itemCount: number;
    total: number;
}

export default function CartPage() {
    const router = useRouter();
    const { formatPrice } = useCurrency();
    const [cart, setCart] = useState<CartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [couponCode, setCouponCode] = useState("");
    const [couponApplied, setCouponApplied] = useState<string | null>(null);
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [checkingOut, setCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    useEffect(() => {
        fetchCart();
    }, []);

    const fetchCart = async () => {
        try {
            const res = await fetch("/api/v1/store/cart");
            if (res.ok) {
                const data = await res.json();
                setCart(data);
            }
        } catch (error) {
            console.error("Failed to fetch cart:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (productId: string, quantity: number) => {
        try {
            await fetch("/api/v1/store/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, quantity }),
            });
            fetchCart();
        } catch (error) {
            console.error("Failed to update cart:", error);
        }
    };

    const removeItem = async (productId: string) => {
        updateQuantity(productId, 0);
    };

    const clearCart = async () => {
        try {
            await fetch("/api/v1/store/cart", { method: "DELETE" });
            fetchCart();
        } catch (error) {
            console.error("Failed to clear cart:", error);
        }
    };

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponError(null);
        setCouponApplied(null);
        setCouponDiscount(0);

        try {
            const res = await fetch("/api/v1/store/coupons/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: couponCode.trim(), subtotal: cart?.total || 0 }),
            });
            const data = await res.json();
            if (data.valid) {
                setCouponApplied(data.coupon.code);
                setCouponDiscount(data.coupon.discount);
            } else {
                setCouponError(data.error || "Invalid coupon");
            }
        } catch {
            setCouponError("Failed to validate coupon");
        }
    };

    const removeCoupon = () => {
        setCouponApplied(null);
        setCouponDiscount(0);
        setCouponCode("");
        setCouponError(null);
    };

    const handleCheckout = async () => {
        if (!cart || cart.items.length === 0) return;

        setCheckingOut(true);
        setCheckoutError(null);

        try {
            const res = await fetch("/api/v1/store/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: cart.items.map((item) => ({
                        productId: item.product.id,
                        quantity: item.quantity,
                    })),
                    couponCode: couponApplied || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setCheckoutError(data.error || "Checkout failed");
                return;
            }

            // If Stripe is configured, redirect to Stripe checkout
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }

            // Otherwise (dev mode), redirect to success page
            router.push("/store/order-success");
        } catch {
            setCheckoutError("Something went wrong. Please try again.");
        } finally {
            setCheckingOut(false);
        }
    };

    const finalTotal = cart ? cart.total - couponDiscount : 0;

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                    </div>
                ) : !cart || cart.items.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <span className="text-6xl mb-4 block">🛒</span>
                            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
                            <p className="text-muted-foreground mb-6">
                                Add some items to get started
                            </p>
                            <Link href="/store">
                                <Button>Browse Store</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Cart Items */}
                        <div className="lg:col-span-2 space-y-4">
                            {cart.items.map((item) => (
                                <Card key={item.id}>
                                    <CardContent className="p-4">
                                        <div className="flex gap-4">
                                            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                                {item.product.image ? (
                                                    <img
                                                        src={item.product.image}
                                                        alt={item.product.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <span className="text-2xl">📦</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <Link
                                                    href={`/store/product/${item.product.id}`}
                                                    className="font-semibold hover:text-primary transition-colors"
                                                >
                                                    {item.product.name}
                                                </Link>
                                                <p className="text-primary font-bold mt-1">
                                                    {formatPrice(item.product.price)}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                                                >
                                                    -
                                                </Button>
                                                <span className="w-8 text-center">{item.quantity}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                >
                                                    +
                                                </Button>
                                            </div>

                                            <div className="text-right">
                                                <p className="font-bold">
                                                    {formatPrice(item.product.price * item.quantity)}
                                                </p>
                                                <button
                                                    onClick={() => removeItem(item.product.id)}
                                                    className="text-sm text-destructive hover:underline mt-1"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Button variant="ghost" onClick={clearCart} className="text-muted-foreground">
                                Clear Cart
                            </Button>
                        </div>

                        {/* Order Summary */}
                        <div>
                            <Card className="sticky top-24">
                                <CardHeader>
                                    <CardTitle>Order Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Items ({cart.itemCount})</span>
                                        <span>{formatPrice(cart.total)}</span>
                                    </div>

                                    {/* Coupon */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Coupon Code</label>
                                        {couponApplied ? (
                                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-700">{couponApplied}</span>
                                                </div>
                                                <button onClick={removeCoupon}>
                                                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Enter code"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                                                />
                                                <Button variant="outline" onClick={applyCoupon}>
                                                    Apply
                                                </Button>
                                            </div>
                                        )}
                                        {couponError && (
                                            <p className="text-sm text-destructive">{couponError}</p>
                                        )}
                                    </div>

                                    {couponDiscount > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Discount</span>
                                            <span>-{formatPrice(couponDiscount)}</span>
                                        </div>
                                    )}

                                    <hr className="border-border" />

                                    <div className="flex justify-between text-lg font-bold">
                                        <span>Total</span>
                                        <span className="text-primary">{formatPrice(finalTotal)}</span>
                                    </div>

                                    {checkoutError && (
                                        <p className="text-sm text-destructive text-center">{checkoutError}</p>
                                    )}

                                    <Button
                                        className="w-full"
                                        size="lg"
                                        onClick={handleCheckout}
                                        disabled={checkingOut}
                                    >
                                        {checkingOut ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                                        ) : (
                                            "Proceed to Checkout"
                                        )}
                                    </Button>

                                    <p className="text-xs text-muted-foreground text-center">
                                        Secure checkout powered by uxwVend
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
