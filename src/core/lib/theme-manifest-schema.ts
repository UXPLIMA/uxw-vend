import { z } from "zod";

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?$/;
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const SEMVER = /^\d+\.\d+\.\d+/;

const colorDef = z.object({
    type: z.literal("color"),
    default: z.string().regex(HEX, "Must be a hex color").optional(),
    group: z.string().max(64).optional(),
    label: z.string().max(100).optional(),
});

const fontDef = z.object({
    type: z.literal("font"),
    default: z.string().max(100).optional(),
    options: z.array(z.string().max(100)).max(100).optional(),
    label: z.string().max(100).optional(),
});

const selectDef = z.object({
    type: z.literal("select"),
    default: z.string().max(64).optional(),
    options: z.array(z.object({
        value: z.string().max(64),
        label: z.string().max(100),
    })).min(1).max(100),
    label: z.string().max(100).optional(),
});

const sliderDef = z.object({
    type: z.literal("slider"),
    default: z.number().optional(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(),
    label: z.string().max(100).optional(),
});

const toggleDef = z.object({
    type: z.literal("toggle"),
    default: z.boolean().optional(),
    label: z.string().max(100).optional(),
});

const textDef = z.object({
    type: z.literal("text"),
    default: z.string().max(10000).optional(),
    max: z.number().int().positive().max(10000).optional(),
    label: z.string().max(100).optional(),
});

const urlDef = z.object({
    type: z.literal("url"),
    default: z.string().url().optional(),
    label: z.string().max(100).optional(),
});

const richTextDef = z.object({
    type: z.literal("richtext"),
    default: z.string().max(10000).optional(),
    max: z.number().int().positive().max(10000).optional(),
    label: z.string().max(100).optional(),
});

const imageDef = z.object({
    type: z.literal("image"),
    default: z.string().url().optional(),
    aspectRatio: z.string().max(20).optional(),
    maxKb: z.number().int().positive().max(10000).optional(),
    label: z.string().max(100).optional(),
});

const fieldDef = z.discriminatedUnion("type", [
    colorDef, fontDef, selectDef, sliderDef, toggleDef,
    textDef, urlDef, richTextDef, imageDef,
]);

const configGroup = z.object({
    label: z.string().min(1).max(100),
    fields: z.record(z.string().regex(SAFE_KEY), fieldDef),
});

export const themeManifestSchema = z.object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(64).regex(SAFE_ID),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    version: z.string().regex(SEMVER),
    author: z.string().max(100).optional(),
    type: z.enum(["light", "dark"]).default("light"),
    parent: z.string().regex(SAFE_ID).optional(),
    preview: z.string().max(256).optional(),

    tokens: z.object({
        colors: z.record(z.string().regex(SAFE_KEY), colorDef).optional(),
        fonts: z.record(z.string().regex(SAFE_KEY), fontDef).optional(),
        radius: z.union([selectDef, sliderDef]).optional(),
        space: sliderDef.optional(),
    }).default({}),

    config: z.record(z.string().regex(SAFE_KEY), configGroup).default({}),

    slots: z.array(z.object({
        name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9.-]+$/),
    })).max(100).optional(),

    translations: z.record(
        z.string(),
        z.record(z.string(), z.record(z.string(), z.string())),
    ).optional(),
}).strict();

export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeFieldDef = z.infer<typeof fieldDef>;
