"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { CheckCircle, ShoppingBag, ArrowRight } from "lucide-react";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

export default function OrderSuccessPage() {
    const t = useTranslations("store");
    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-12 flex-1 flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-foreground mb-2">{t("orderSuccess_title")}</h1>
                        <p className="text-muted-foreground mb-8">
                            {t("orderSuccess_body")}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link href="/profile">
                                <Button variant="outline">
                                    <ShoppingBag className="w-4 h-4 mr-2" /> {t("orderSuccess_myOrders")}
                                </Button>
                            </Link>
                            <Link href="/store">
                                <Button>
                                    {t("orderSuccess_continue")} <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </main>

            <Footer />
        </div>
    );
}
