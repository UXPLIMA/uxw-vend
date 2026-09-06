"use client";

import React from "react";
import type { Config } from "@measured/puck";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { NavIcon } from "@/core/components/ui/NavIcon";

/** Editor-only: keeps the picker (and lucide's whole name table) off public pages. */
const LazyIconPicker = dynamic(
    () => import("@/core/components/ui/icon-picker").then((m) => m.IconPicker),
    { ssr: false },
);

/**
 * Core block library for the Puck-based page builder.
 *
 * Each block declares:
 *   - fields: schema for the inspector panel (text, number, select, etc.)
 *   - defaultProps: starting values when added
 *   - render: React component that renders the block on the public page
 *
 * Modules can extend this library by exporting their own block definitions
 * and registering them via getBlockConfig() - see ModuleBlocks below.
 *
 * Every `label` and category `title` here is a key in the `admin` catalogue,
 * not a sentence. Puck renders them verbatim, so a Turkish operator opening
 * the builder read an inspector that was English top to bottom on a panel
 * that was Turkish everywhere else. `localizeBlockConfig` swaps a label the
 * catalogue knows for its translation and leaves anything else alone, which
 * is also how a module's own block opts in: put the key in the module's
 * `admin` namespace and use it as the label.
 */

// ──────────────────── Hero Block ────────────────────
const HeroBlock = {
    label: "blocks_hero",
    fields: {
        title: { type: "text" as const, label: "blocks_field_title" },
        subtitle: { type: "textarea" as const, label: "blocks_field_subtitle" },
        backgroundImage: { type: "text" as const, label: "blocks_field_backgroundImage" },
        ctaText: { type: "text" as const, label: "blocks_field_buttonText" },
        ctaUrl: { type: "text" as const, label: "blocks_field_buttonUrl" },
        height: {
            type: "select" as const,
            label: "blocks_field_height",
            options: [
                { label: "blocks_opt_small", value: "300px" },
                { label: "blocks_opt_medium", value: "450px" },
                { label: "blocks_opt_large", value: "600px" },
            ],
        },
    },
    defaultProps: {
        title: "Welcome",
        subtitle: "Discover what we offer",
        backgroundImage: "",
        ctaText: "Get Started",
        ctaUrl: "/",
        height: "450px",
    },
    render: ({ title, subtitle, backgroundImage, ctaText, ctaUrl, height }: {
        title: string; subtitle: string; backgroundImage: string;
        ctaText: string; ctaUrl: string; height: string;
    }) => (
        <div
            className="relative flex items-center justify-center text-center overflow-hidden"
            style={{
                height,
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "var(--color-muted)",
            }}
        >
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 max-w-2xl px-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{title}</h1>
                {subtitle && <p className="text-lg md:text-xl text-white/90 mb-6">{subtitle}</p>}
                {ctaText && (
                    <a
                        href={ctaUrl || "/"}
                        className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
                    >
                        {ctaText}
                    </a>
                )}
            </div>
        </div>
    ),
};

// ──────────────────── Heading Block ────────────────────
const HeadingBlock = {
    label: "blocks_heading",
    fields: {
        text: { type: "text" as const, label: "blocks_field_text" },
        level: {
            type: "select" as const,
            label: "blocks_field_level",
            options: [
                { label: "H1", value: "h1" },
                { label: "H2", value: "h2" },
                { label: "H3", value: "h3" },
                { label: "H4", value: "h4" },
            ],
        },
        align: {
            type: "select" as const,
            label: "blocks_field_alignment",
            options: [
                { label: "blocks_opt_left", value: "left" },
                { label: "blocks_opt_center", value: "center" },
                { label: "blocks_opt_right", value: "right" },
            ],
        },
    },
    defaultProps: { text: "Heading", level: "h2", align: "left" },
    render: ({ text, level, align }: { text: string; level: string; align: string }) => {
        const Tag = level as keyof React.JSX.IntrinsicElements;
        const sizes: Record<string, string> = {
            h1: "text-4xl md:text-5xl font-bold",
            h2: "text-3xl md:text-4xl font-bold",
            h3: "text-2xl md:text-3xl font-semibold",
            h4: "text-xl md:text-2xl font-semibold",
        };
        return (
            <div className="container mx-auto px-4 py-4">
                <Tag className={`${sizes[level] || sizes.h2} text-foreground`} style={{ textAlign: align as "left" | "center" | "right" }}>
                    {text}
                </Tag>
            </div>
        );
    },
};

// ──────────────────── Text Block ────────────────────
const TextBlock = {
    label: "blocks_text",
    fields: {
        content: { type: "textarea" as const, label: "blocks_field_content" },
        align: {
            type: "select" as const,
            label: "blocks_field_alignment",
            options: [
                { label: "blocks_opt_left", value: "left" },
                { label: "blocks_opt_center", value: "center" },
                { label: "blocks_opt_right", value: "right" },
            ],
        },
    },
    defaultProps: { content: "Add your text here…", align: "left" },
    render: ({ content, align }: { content: string; align: string }) => (
        <div className="container mx-auto px-4 py-4">
            <p className="text-base text-muted-foreground leading-relaxed" style={{ textAlign: align as "left" | "center" | "right" }}>
                {content}
            </p>
        </div>
    ),
};

// ──────────────────── Image Block ────────────────────
/**
 * What an Image block shows before anyone has given it a source. It is drawn
 * on the public page as well as in the builder, so its wording comes from
 * `common` rather than from the operator-only catalogue.
 */
function EmptyImage() {
    const t = useTranslations("common");
    return (
        <div className="bg-muted h-48 w-full rounded-lg flex items-center justify-center text-muted-foreground">
            {t("noImage")}
        </div>
    );
}

const ImageBlock = {
    label: "blocks_image",
    fields: {
        src: { type: "text" as const, label: "blocks_field_imageUrl" },
        alt: { type: "text" as const, label: "blocks_field_altText" },
        maxWidth: { type: "text" as const, label: "blocks_field_maxWidth" },
    },
    defaultProps: { src: "", alt: "", maxWidth: "100%" },
    render: ({ src, alt, maxWidth }: { src: string; alt: string; maxWidth: string }) => (
        <div className="container mx-auto px-4 py-4 flex justify-center">
            {src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={src} alt={alt} style={{ maxWidth }} className="rounded-lg" />
            ) : (
                <EmptyImage />
            )}
        </div>
    ),
};

// ──────────────────── Button Block ────────────────────
const ButtonBlock = {
    label: "blocks_button",
    fields: {
        text: { type: "text" as const, label: "blocks_field_buttonText" },
        url: { type: "text" as const, label: "blocks_field_url" },
        variant: {
            type: "select" as const,
            label: "blocks_field_style",
            options: [
                { label: "blocks_opt_primary", value: "primary" },
                { label: "blocks_opt_outline", value: "outline" },
                { label: "blocks_opt_ghost", value: "ghost" },
            ],
        },
        align: {
            type: "select" as const,
            label: "blocks_field_alignment",
            options: [
                { label: "blocks_opt_left", value: "left" },
                { label: "blocks_opt_center", value: "center" },
                { label: "blocks_opt_right", value: "right" },
            ],
        },
    },
    defaultProps: { text: "Click me", url: "/", variant: "primary", align: "left" },
    render: ({ text, url, variant, align }: { text: string; url: string; variant: string; align: string }) => {
        const styles: Record<string, string> = {
            primary: "bg-primary text-primary-foreground hover:opacity-90",
            outline: "border border-border text-foreground hover:bg-muted",
            ghost: "text-foreground hover:bg-muted",
        };
        return (
            <div className="container mx-auto px-4 py-4" style={{ textAlign: align as "left" | "center" | "right" }}>
                <a href={url || "/"} className={`inline-block px-6 py-2.5 rounded-md font-medium transition-colors ${styles[variant] || styles.primary}`}>
                    {text}
                </a>
            </div>
        );
    },
};

// ──────────────────── Spacer Block ────────────────────
const SpacerBlock = {
    label: "blocks_spacer",
    fields: {
        height: {
            type: "select" as const,
            label: "blocks_field_height",
            options: [
                { label: "blocks_opt_small", value: "20px" },
                { label: "blocks_opt_medium", value: "40px" },
                { label: "blocks_opt_large", value: "80px" },
            ],
        },
    },
    defaultProps: { height: "40px" },
    render: ({ height }: { height: string }) => <div style={{ height }} />,
};

// ──────────────────── Card Block ────────────────────
const CardBlock = {
    label: "blocks_card",
    fields: {
        title: { type: "text" as const, label: "blocks_field_title" },
        description: { type: "textarea" as const, label: "blocks_field_description" },
        // A Puck "custom" field so the inspector shows the same icon picker the
        // rest of the admin uses. The picker is loaded on demand: this module
        // is also on the public render path, where the inspector never mounts.
        icon: {
            type: "custom" as const,
            label: "blocks_field_icon",
            render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
                <LazyIconPicker value={value} onChange={onChange} />
            ),
        },
    },
    defaultProps: { title: "Feature", description: "Describe a feature here", icon: "" },
    render: ({ title, description, icon }: { title: string; description: string; icon?: string }) => (
        <div className="container mx-auto px-4 py-4">
            <div className="bg-card border border-border rounded-lg p-6">
                <NavIcon name={icon} className="w-6 h-6 text-primary mb-3" />
                <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
            </div>
        </div>
    ),
};

/**
 * Core block config - register every built-in block here.
 * Modules can extend this by merging their own blocks at runtime.
 */
export type CoreBlockProps = {
    Hero: typeof HeroBlock.defaultProps;
    Heading: typeof HeadingBlock.defaultProps;
    Text: typeof TextBlock.defaultProps;
    Image: typeof ImageBlock.defaultProps;
    Button: typeof ButtonBlock.defaultProps;
    Spacer: typeof SpacerBlock.defaultProps;
    Card: typeof CardBlock.defaultProps;
};

export const coreBlockConfig: Config<CoreBlockProps> = {
    components: {
        Hero: HeroBlock,
        Heading: HeadingBlock,
        Text: TextBlock,
        Image: ImageBlock,
        Button: ButtonBlock,
        Spacer: SpacerBlock,
        Card: CardBlock,
    },
    categories: {
        layout: {
            title: "blocks_cat_layout",
            components: ["Hero", "Spacer"],
        },
        content: {
            title: "blocks_cat_content",
            components: ["Heading", "Text", "Image", "Button", "Card"],
        },
    },
};

/**
 * Modules contribute blocks via the `pageBlocks` manifest field.
 * The build-time registry generator collects them into module-blocks.ts;
 * the page editor merges them with coreBlockConfig at render time.
 */
