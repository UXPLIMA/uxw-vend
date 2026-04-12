"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { FileJson, ExternalLink } from "lucide-react";
import "swagger-ui-react/swagger-ui.css";

// swagger-ui-react bundles its own styles and touches window, so it must be
// loaded on the client only.
const SwaggerUI = dynamic(
    () => import("swagger-ui-react").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => (
            <div className="text-sm text-muted-foreground p-6">
                Loading API explorer...
            </div>
        ),
    },
);

export default function ApiDocsPage() {
    const t = useTranslations("admin");

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-semibold">{t("apiDocs_title")}</h1>
                    <p className="text-muted-foreground">
                        {t("apiDocs_subtitle")}
                    </p>
                </div>
                <a
                    href="/api/v1/openapi"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                    <FileJson className="w-4 h-4" />
                    {t("apiDocs_rawSpec")}
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t("apiDocs_endpoints")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="swagger-ui-wrapper">
                        <SwaggerUI url="/api/v1/openapi" />
                    </div>
                </CardContent>
            </Card>

            <style jsx global>{`
                .swagger-ui-wrapper .swagger-ui .topbar {
                    display: none;
                }
                .swagger-ui-wrapper .swagger-ui .info {
                    margin: 20px;
                }
            `}</style>
        </div>
    );
}
