"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { formatCurrency, formatDate } from "@/core/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
    user: { id: string; username: string; email: string };
    items: { id: string }[];
}

const statuses = ["ALL", "PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"];

const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-muted text-muted-foreground",
};

export default function AdminOrdersPage() {
    const t = useTranslations("store");
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState("ALL");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/store/orders?page=${page}&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
                setTotal(data.pagination?.total || 0);
                setTotalPages(data.pagination?.pages || 1);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page]);  // eslint-disable-line react-hooks/exhaustive-deps

    const filteredOrders = activeStatus === "ALL"
        ? orders
        : orders.filter((o) => o.status === activeStatus);

    // Count per status from current page
    const statusCounts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_orders")}</h1>
                    <p className="text-muted-foreground">{t("adm_ordersTotal", { count: total })}</p>
                </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {statuses.map((status) => (
                    <Button
                        key={status}
                        variant={activeStatus === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveStatus(status)}
                    >
                        {status === "ALL" ? t("adm_all") : t(`adm_orderStatus_${status}`)}
                        {status !== "ALL" && statusCounts[status] ? (
                            <span className="ml-1 text-xs opacity-70">({statusCounts[status]})</span>
                        ) : null}
                    </Button>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {activeStatus === "ALL" ? t("adm_allOrders") : t("adm_statusOrders", { status: activeStatus })}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingCart className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">{t("adm_noOrdersFound")}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_orderNumber", { number: "" }).trim()}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_customer")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_date")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_items")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_total")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_status")}</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("adm_actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <p className="font-medium">{order.orderNumber}</p>
                                            </td>
                                            <td className="py-3 px-4">
                                                <p>{order.user.username}</p>
                                                <p className="text-xs text-muted-foreground">{order.user.email}</p>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {formatDate(new Date(order.createdAt))}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {t("adm_itemsCount", { count: order.items.length })}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {formatCurrency(Number(order.total))}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`text-xs px-2 py-1 rounded ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Link href={`/admin/store/orders/${order.id}`}>
                                                    <Button variant="ghost" size="sm">{t("adm_view")}</Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                {t("adm_pageOf", { page, totalPages })}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === totalPages}
                                    onClick={() => setPage(page + 1)}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
