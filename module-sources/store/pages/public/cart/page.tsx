"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link, useRouter } from "@/core/sdk/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/core/sdk/ui";
import { Footer, Navbar } from "@/core/sdk/layout";
import { ThemeComponentSlot } from "@/core/sdk/theme";
import { useCurrency } from "../../../lib/currency-context";
import * as LucideIcons from "lucide-react";
import { Loader2, Check, X, CreditCard, Coins, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

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

/** One installed gateway, as `/store/payment-providers` describes it. */
interface PaymentProvider {
    id: string;
    label: string;
    description?: string;
    icon?: string;
}

interface CartData {
    items: CartItem[];
    itemCount: number;
    total: number;
}

type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * Draws the Lucide icon a gateway named in its `payment.providers` answer.
 *
 * The name comes from an installed module, so it is trusted but not
 * guaranteed to exist: a typo falls back to a card rather than crashing the
 * checkout page.
 */
function ProviderIcon({ name }: { name?: string }) {
    const lib = LucideIcons as unknown as Record<string, IconComponent>;
    const Icon = (name && lib[name]) || CreditCard;
    return <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />;
}

export default function CartPage() {
    const router = useRouter();
    const { formatPrice } = useCurrency();
    const t = useTranslations('store');
    const commonT = useTranslations('common');
    const [cart, setCart] = useState<CartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [couponCode, setCouponCode] = useState("");
    const [couponApplied, setCouponApplied] = useState<string | null>(null);
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [checkingOut, setCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState("");
    const [creatorCodeInput, setCreatorCodeInput] = useState("");
    const [creatorApplied, setCreatorApplied] = useState<{ code: string; discountPercent: number; creator: string } | null>(null);
    const [creatorError, setCreatorError] = useState<string | null>(null);
    // The gateway ids come from whichever gateway modules are installed, so
    // this is a plain string rather than a union the store would have to know.
    const [paymentMethod, setPaymentMethod] = useState<string>("");
    const [providers, setProviders] = useState<PaymentProvider[]>([]);
    const [creditsAvailable, setCreditsAvailable] = useState(false);
    const [creditBalance, setCreditBalance] = useState<number>(0);

    useEffect(() => {
        fetchCart();
        // Which gateways are installed and configured is a question only the
        // server can answer - it is the sum of the payment.providers filter.
        fetch("/api/v1/store/payment-providers")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const list: PaymentProvider[] = Array.isArray(data?.providers) ? data.providers : [];
                setProviders(list);
                setPaymentMethod(prev => prev || list[0]?.id || "");
            })
            .catch(() => {});
        // The wallet is a module too: no credits endpoint, no credits button.
        fetch("/api/v1/credits")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.balance === undefined) return;
                setCreditsAvailable(true);
                setCreditBalance(Number(data.balance));
                setPaymentMethod(prev => prev || "credits");
            })
            .catch(() => {});
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
                setCouponError(data.error || (t.has("err_invalidCoupon") ? t("err_invalidCoupon") : "Invalid coupon"));
            }
        } catch {
            setCouponError(t.has("err_validateCoupon") ? t("err_validateCoupon") : "Failed to validate coupon");
        }
    };

    const removeCoupon = () => {
        setCouponApplied(null);
        setCouponDiscount(0);
        setCouponCode("");
        setCouponError(null);
    };

    const applyCreatorCode = async () => {
        if (!creatorCodeInput.trim()) return;
        setCreatorError(null);
        setCreatorApplied(null);
        try {
            const res = await fetch(`/api/v1/store/creator-codes/validate?code=${encodeURIComponent(creatorCodeInput.trim())}`);
            const data = await res.json();
            if (data.valid) {
                setCreatorApplied({ code: data.code, discountPercent: data.discountPercent, creator: data.creator });
            } else {
                setCreatorError(t.has("err_invalidCreatorCode") ? t("err_invalidCreatorCode") : "Invalid creator code");
            }
        } catch {
            setCreatorError(t.has("err_validateCreatorCode") ? t("err_validateCreatorCode") : "Failed to validate creator code");
        }
    };

    const removeCreatorCode = () => {
        setCreatorApplied(null);
        setCreatorCodeInput("");
        setCreatorError(null);
    };

    const handleCheckout = async () => {
        if (!cart || cart.items.length === 0) return;
        if (!playerName.trim()) { setCheckoutError(t('playerNameRequired')); return; }

        setCheckingOut(true);
        setCheckoutError(null);

        try {
            // Step 1: Create the order via the standard checkout endpoint
            const res = await fetch("/api/v1/store/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: cart.items.map((item) => ({
                        productId: item.product.id,
                        quantity: item.quantity,
                    })),
                    playerName: playerName.trim(),
                    couponCode: couponApplied || undefined,
                    creatorCode: creatorApplied?.code || undefined,
                    paymentMethod,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setCheckoutError(data.error || (t.has("err_checkoutFailed") ? t("err_checkoutFailed") : "Checkout failed"));
                return;
            }

            // Step 2: follow the gateway. Which one it was is not this page's
            // business - the checkout route answers with a URL or with nothing.
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }

            // Free order or dev mode: redirect to success page
            router.push("/store/order-success");
        } catch {
            setCheckoutError(t.has("err_generic") ? t("err_generic") : "Something went wrong. Please try again.");
        } finally {
            setCheckingOut(false);
        }
    };

    const finalTotal = cart ? cart.total - couponDiscount : 0;

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                <h1 className="text-3xl font-bold mb-8">{t('shoppingCart')}</h1>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                    </div>
                ) : !cart || cart.items.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h2 className="text-xl font-semibold mb-2">{t('cartEmpty')}</h2>
                            <p className="text-muted-foreground mb-6">
                                {t('cartEmptyDesc')}
                            </p>
                            <Link href="/store">
                                <Button>{t('browseStore')}</Button>
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
                                                    <Image
                                                        src={item.product.image}
                                                        alt={item.product.name}
                                                        width={80}
                                                        height={80}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                                        <ShoppingCart className="w-6 h-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <Link
                                                    href={`/store/product/${item.product.id}/${item.product.slug}`}
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
                                                    {t('remove')}
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Button variant="ghost" onClick={clearCart} className="text-muted-foreground">
                                {t('clearCart')}
                            </Button>
                        </div>

                        {/* Order Summary */}
                        <div>
                            <Card className="sticky top-24">
                                <CardHeader>
                                    <CardTitle>{t('orderSummary')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('items', { count: cart.itemCount })}</span>
                                        <span>{formatPrice(cart.total)}</span>
                                    </div>

                                    {/* Coupon */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('couponCode')}</label>
                                        {couponApplied ? (
                                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-700">{couponApplied}</span>
                                                </div>
                                                <button onClick={removeCoupon} aria-label={commonT('remove')}>
                                                    <X className="w-4 h-4 text-muted-foreground hover:text-muted-foreground" aria-hidden="true" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={t('enterCode')}
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                                                />
                                                <Button variant="outline" onClick={applyCoupon}>
                                                    {t('apply')}
                                                </Button>
                                            </div>
                                        )}
                                        {couponError && (
                                            <p className="text-sm text-destructive">{couponError}</p>
                                        )}
                                    </div>

                                    {/* Creator Code */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('creatorCode')}</label>
                                        {creatorApplied ? (
                                            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-blue-600" />
                                                    <span className="text-sm font-medium text-blue-700">{creatorApplied.code} ({creatorApplied.discountPercent}% off)</span>
                                                </div>
                                                <button onClick={removeCreatorCode} aria-label={commonT('remove')}>
                                                    <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={t('creatorCode')}
                                                    value={creatorCodeInput}
                                                    onChange={(e) => setCreatorCodeInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && applyCreatorCode()}
                                                />
                                                <Button variant="outline" onClick={applyCreatorCode}>{t('apply')}</Button>
                                            </div>
                                        )}
                                        {creatorError && <p className="text-sm text-destructive">{creatorError}</p>}
                                    </div>

                                    {/* Player Name */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('playerName')} <span className="text-destructive">*</span></label>
                                        <Input
                                            placeholder={t('playerNamePlaceholder')}
                                            value={playerName}
                                            onChange={(e) => setPlayerName(e.target.value)}
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">{t('playerNameHelp')}</p>
                                    </div>

                                    {couponDiscount > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>{t('couponDiscount')}</span>
                                            <span>-{formatPrice(couponDiscount)}</span>
                                        </div>
                                    )}

                                    {creatorApplied && (
                                        <div className="flex justify-between text-blue-600">
                                            <span>{t('creatorDiscount', { percent: creatorApplied.discountPercent })}</span>
                                            <span>-{formatPrice((cart.total - couponDiscount) * creatorApplied.discountPercent / 100)}</span>
                                        </div>
                                    )}

                                    <hr className="border-border" />

                                    <div className="flex justify-between text-lg font-bold">
                                        <span>{t('total')}</span>
                                        <span className="text-primary">{formatPrice(
                                            Math.max(0, cart.total - couponDiscount - (creatorApplied ? (cart.total - couponDiscount) * creatorApplied.discountPercent / 100 : 0))
                                        )}</span>
                                    </div>

                                    {/* Payment Method */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('paymentMethod')}</label>
                                        <div className="grid gap-2">
                                            {providers.map((provider) => (
                                                <button
                                                    key={provider.id}
                                                    type="button"
                                                    onClick={() => setPaymentMethod(provider.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                                                        paymentMethod === provider.id
                                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                            : "border-border hover:border-muted-foreground"
                                                    }`}
                                                >
                                                    <ProviderIcon name={provider.icon} />
                                                    <div className="flex-1">
                                                        <span className="text-sm font-medium">{provider.label}</span>
                                                        {provider.description && (
                                                            <p className="text-xs text-muted-foreground">{provider.description}</p>
                                                        )}
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                        paymentMethod === provider.id ? "border-primary" : "border-muted-foreground"
                                                    }`}>
                                                        {paymentMethod === provider.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                    </div>
                                                </button>
                                            ))}
                                            {creditsAvailable && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentMethod("credits")}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                                                        paymentMethod === "credits"
                                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                            : "border-border hover:border-muted-foreground"
                                                    }`}
                                                >
                                                    <Coins className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <span className="text-sm font-medium">{t('payWithCredits')}</span>
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('balance', { amount: formatPrice(creditBalance) })}
                                                            {cart && creditBalance < Math.max(0, cart.total - couponDiscount - (creatorApplied ? (cart.total - couponDiscount) * creatorApplied.discountPercent / 100 : 0)) && (
                                                                <span className="text-destructive ml-1">({t('insufficient')})</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                        paymentMethod === "credits" ? "border-primary" : "border-muted-foreground"
                                                    }`}>
                                                        {paymentMethod === "credits" && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                    </div>
                                                </button>
                                            )}
                                            {providers.length === 0 && !creditsAvailable && (
                                                <p className="text-sm text-muted-foreground">{t('noPaymentMethods')}</p>
                                            )}
                                        </div>
                                    </div>

                                    {checkoutError && (
                                        <p className="text-sm text-destructive text-center">{checkoutError}</p>
                                    )}

                                    <Button
                                        className="w-full"
                                        size="lg"
                                        onClick={handleCheckout}
                                        disabled={checkingOut || !playerName.trim() || !paymentMethod}
                                    >
                                        {checkingOut ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('processing')}</>
                                        ) : (
                                            t('proceedToCheckout')
                                        )}
                                    </Button>

                                    <p className="text-xs text-muted-foreground text-center">
                                        {t('secureCheckout')}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
