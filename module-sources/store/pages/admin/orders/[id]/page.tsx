import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { formatCurrency, formatDate } from "@/core/lib/utils";
import { ArrowLeft, Package } from "lucide-react";
import { OrderStatusSelect } from "./status-select";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
    const t = await getTranslations("store");
    const session = await auth();
    if (!session?.user) redirect("/auth/login");

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) redirect("/");

    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, username: true, email: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, slug: true, image: true } },
                },
            },
            payments: true,
        },
    });

    if (!order) notFound();

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/store/orders">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">{t("adm_orderNumber", { number: order.orderNumber })}</h1>
                    <p className="text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Order Items */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("adm_itemsWithCount", { count: order.items.length })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                                        <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                            {item.product?.image ? (
                                                <Image src={item.product.image} alt={item.product?.name || "Product"} width={48} height={48} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{item.product?.name || t("adm_deletedProduct")}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatCurrency(Number(item.price))} x {item.quantity}
                                            </p>
                                        </div>
                                        <p className="font-medium">
                                            {formatCurrency(Number(item.price) * item.quantity)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-border mt-4 pt-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t("adm_subtotal")}</span>
                                    <span>{formatCurrency(Number(order.subtotal))}</span>
                                </div>
                                {Number(order.discount) > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>{t("adm_discount")}</span>
                                        <span>-{formatCurrency(Number(order.discount))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold">
                                    <span>{t("adm_total")}</span>
                                    <span>{formatCurrency(Number(order.total))}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {order.notes && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("adm_notes")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">{order.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("adm_customer")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="font-medium">{order.user?.username ?? "Deleted user"}</p>
                            <p className="text-sm text-muted-foreground">{order.user?.email ?? "—"}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("adm_payment")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">
                                <span className="text-muted-foreground">{t("adm_method")}: </span>
                                <span className="font-medium">{order.paymentMethod || "N/A"}</span>
                            </p>
                            <p className="text-sm mt-1">
                                <span className="text-muted-foreground">{t("adm_status")}: </span>
                                <span className="font-medium">{order.status}</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("adm_timeline")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_created")}</span>
                                <span>{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_updated")}</span>
                                <span>{formatDate(order.updatedAt)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
