"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";

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
    const [cart, setCart] = useState<CartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [couponCode, setCouponCode] = useState("");

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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    return (
        <div className="min-h-screen gradient-bg">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                <span className="text-white font-bold text-sm">U</span>
                            </div>
                            <span className="font-bold text-xl">uxwVend</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <Link href="/store">
                                <Button variant="ghost" size="sm">Back to Store</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-16 px-4">
                <div className="container mx-auto max-w-4xl">
                    <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Loading...</p>
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
                                                        href={`/store/product/${item.product.slug}`}
                                                        className="font-semibold hover:text-primary transition-colors"
                                                    >
                                                        {item.product.name}
                                                    </Link>
                                                    <p className="text-primary font-bold mt-1">
                                                        {formatCurrency(item.product.price)}
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
                                                        {formatCurrency(item.product.price * item.quantity)}
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
                                            <span>{formatCurrency(cart.total)}</span>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Coupon Code</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Enter code"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value)}
                                                />
                                                <Button variant="outline">Apply</Button>
                                            </div>
                                        </div>

                                        <hr className="border-border" />

                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Total</span>
                                            <span className="text-primary">{formatCurrency(cart.total)}</span>
                                        </div>

                                        <Button className="w-full" size="lg">
                                            Proceed to Checkout
                                        </Button>

                                        <p className="text-xs text-muted-foreground text-center">
                                            Secure checkout powered by uxwVend
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
