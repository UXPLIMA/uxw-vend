"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { CheckCircle, ShoppingBag, ArrowRight } from "lucide-react";

export default function OrderSuccessPage() {
    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-12 flex-1 flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-foreground mb-2">Order Successful!</h1>
                        <p className="text-muted-foreground mb-8">
                            Thank you for your purchase. Your order has been placed and is being processed.
                        </p>

                        <div className="flex gap-3 justify-center">
                            <Link href="/profile">
                                <Button variant="outline">
                                    <ShoppingBag className="w-4 h-4 mr-2" /> My Orders
                                </Button>
                            </Link>
                            <Link href="/store">
                                <Button>
                                    Continue Shopping <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
