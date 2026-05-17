import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { getTranslations } from "next-intl/server";
import { Navbar, Footer } from "@/core/components/layout";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";
import { prisma } from "@/core/lib/db";
import { buildPageMeta } from "@/core/lib/seo";
import type { Metadata } from "next";

// Core legal pages — terms, privacy, refund, rules — backed by a single
// settings key per slug. Renders sanitized admin-edited HTML, or a
// friendly placeholder if the admin hasn't filled it in yet. Adding a
// new legal page is one entry in LEGAL_PAGES + one Setting row.

const LEGAL_PAGES: Record<string, { titleKey: string; settingKey: string }> = {
    terms:   { titleKey: "termsOfService", settingKey: "legal_terms" },
    privacy: { titleKey: "privacyPolicy",  settingKey: "legal_privacy" },
    refund:  { titleKey: "refundPolicy",   settingKey: "legal_refund" },
    rules:   { titleKey: "serverRules",    settingKey: "legal_rules" },
};

interface PageProps {
    params: Promise<{ slug: string }>;
}

async function getLegalContent(slug: string): Promise<{ title: string; html: string | null } | null> {
    const page = LEGAL_PAGES[slug];
    if (!page) return null;
    const t = await getTranslations("footer");
    const setting = await prisma.setting.findUnique({ where: { key: page.settingKey } });
    const raw = setting?.value;
    const html = typeof raw === "string" && raw.trim().length > 0 ? raw : null;
    return { title: t(page.titleKey), html };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const content = await getLegalContent(slug);
    if (!content) return {};
    return buildPageMeta({ title: content.title, description: content.title, url: `/${slug}`, type: "website" });
}

export default async function LegalPage({ params }: PageProps) {
    const { slug } = await params;
    const content = await getLegalContent(slug);
    if (!content) notFound();
    const t = await getTranslations("legal");

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-10 flex-1 max-w-3xl">
                <h1 className="text-3xl font-bold text-foreground mb-6">{content.title}</h1>
                {content.html ? (
                    <div
                        className="prose dark:prose-invert max-w-none text-foreground"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.html) }}
                    />
                ) : (
                    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                        <p className="text-muted-foreground">{t("placeholder")}</p>
                        <p className="text-xs text-muted-foreground mt-3">{t("placeholderHint", { key: LEGAL_PAGES[slug].settingKey })}</p>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
