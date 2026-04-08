"use client";

import React from "react";
import type { Config } from "@measured/puck";

/**
 * Core block library for the Puck-based page builder.
 *
 * Each block declares:
 *   - fields: schema for the inspector panel (text, number, select, etc.)
 *   - defaultProps: starting values when added
 *   - render: React component that renders the block on the public page
 *
 * Modules can extend this library by exporting their own block definitions
 * and registering them via getBlockConfig() — see ModuleBlocks below.
 */

// ──────────────────── Hero Block ────────────────────
const HeroBlock = {
    fields: {
        title: { type: "text" as const, label: "Title" },
        subtitle: { type: "textarea" as const, label: "Subtitle" },
        backgroundImage: { type: "text" as const, label: "Background image URL" },
        ctaText: { type: "text" as const, label: "Button text" },
        ctaUrl: { type: "text" as const, label: "Button URL" },
        height: {
            type: "select" as const,
            label: "Height",
            options: [
                { label: "Small", value: "300px" },
                { label: "Medium", value: "450px" },
                { label: "Large", value: "600px" },
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
    fields: {
        text: { type: "text" as const, label: "Text" },
        level: {
            type: "select" as const,
            label: "Level",
            options: [
                { label: "H1", value: "h1" },
                { label: "H2", value: "h2" },
                { label: "H3", value: "h3" },
                { label: "H4", value: "h4" },
            ],
        },
        align: {
            type: "select" as const,
            label: "Alignment",
            options: [
                { label: "Left", value: "left" },
                { label: "Center", value: "center" },
                { label: "Right", value: "right" },
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
    fields: {
        content: { type: "textarea" as const, label: "Content" },
        align: {
            type: "select" as const,
            label: "Alignment",
            options: [
                { label: "Left", value: "left" },
                { label: "Center", value: "center" },
                { label: "Right", value: "right" },
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
const ImageBlock = {
    fields: {
        src: { type: "text" as const, label: "Image URL" },
        alt: { type: "text" as const, label: "Alt text" },
        maxWidth: { type: "text" as const, label: "Max width (e.g. 600px)" },
    },
    defaultProps: { src: "", alt: "", maxWidth: "100%" },
    render: ({ src, alt, maxWidth }: { src: string; alt: string; maxWidth: string }) => (
        <div className="container mx-auto px-4 py-4 flex justify-center">
            {src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={src} alt={alt} style={{ maxWidth }} className="rounded-lg" />
            ) : (
                <div className="bg-muted h-48 w-full rounded-lg flex items-center justify-center text-muted-foreground">
                    No image
                </div>
            )}
        </div>
    ),
};

// ──────────────────── Button Block ────────────────────
const ButtonBlock = {
    fields: {
        text: { type: "text" as const, label: "Button text" },
        url: { type: "text" as const, label: "URL" },
        variant: {
            type: "select" as const,
            label: "Style",
            options: [
                { label: "Primary", value: "primary" },
                { label: "Outline", value: "outline" },
                { label: "Ghost", value: "ghost" },
            ],
        },
        align: {
            type: "select" as const,
            label: "Alignment",
            options: [
                { label: "Left", value: "left" },
                { label: "Center", value: "center" },
                { label: "Right", value: "right" },
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
    fields: {
        height: {
            type: "select" as const,
            label: "Height",
            options: [
                { label: "Small", value: "20px" },
                { label: "Medium", value: "40px" },
                { label: "Large", value: "80px" },
            ],
        },
    },
    defaultProps: { height: "40px" },
    render: ({ height }: { height: string }) => <div style={{ height }} />,
};

// ──────────────────── Card Block ────────────────────
const CardBlock = {
    fields: {
        title: { type: "text" as const, label: "Title" },
        description: { type: "textarea" as const, label: "Description" },
        icon: { type: "text" as const, label: "Lucide icon name (optional)" },
    },
    defaultProps: { title: "Feature", description: "Describe a feature here", icon: "" },
    render: ({ title, description }: { title: string; description: string }) => (
        <div className="container mx-auto px-4 py-4">
            <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
            </div>
        </div>
    ),
};

/**
 * Core block config — register every built-in block here.
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
            title: "Layout",
            components: ["Hero", "Spacer"],
        },
        content: {
            title: "Content",
            components: ["Heading", "Text", "Image", "Button", "Card"],
        },
    },
};

/**
 * Modules contribute blocks via the `pageBlocks` manifest field.
 * The build-time registry generator collects them into module-blocks.ts;
 * the page editor merges them with coreBlockConfig at render time.
 */
