"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ExportImportPage() {
    const [importing, setImporting] = useState(false);

    const exportData = (type: string) => {
        window.open(`/api/v1/admin/export?type=${type}`, "_blank");
    };

    const importProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const text = await file.text();

        const res = await fetch("/api/v1/admin/import?type=products", {
            method: "POST",
            body: text,
        });

        const data = await res.json();
        if (res.ok) toast.success(data.message);
        else toast.error(data.error || "Import failed");

        setImporting(false);
        e.target.value = "";
    };

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Export & Import</h1>
                <p className="text-muted-foreground">Export data as CSV or import from CSV</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Download className="w-4 h-4" /> Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button variant="outline" className="w-full justify-start" onClick={() => exportData("products")}>
                            <Download className="w-4 h-4 mr-2" /> Export Products (CSV)
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => exportData("orders")}>
                            <Download className="w-4 h-4 mr-2" /> Export Orders (CSV)
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => exportData("users")}>
                            <Download className="w-4 h-4 mr-2" /> Export Users (CSV)
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Upload className="w-4 h-4" /> Import
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div>
                            <Label>Import Products (CSV)</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                CSV with columns: name, slug, price, comparePrice, stock, isActive, isFeatured, type, description
                            </p>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={importProducts}
                                disabled={importing}
                            />
                            {importing && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Importing...</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
