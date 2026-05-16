import { z } from "zod";

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;

const relativePath = (label: string) =>
    z.string()
        .min(1, `${label} is required`)
        .max(256, `${label} is too long`)
        .refine((v) => !v.startsWith("/") && !v.startsWith("\\"), {
            message: `${label} must be a relative path`,
        })
        .refine((v) => !/(^|[\\/])\.\.(?:[\\/]|$)/.test(v), {
            message: `${label} must not contain ".."`,
        })
        .refine((v) => !/^[A-Za-z]:[\\/]/.test(v), {
            message: `${label} must not be an absolute Windows path`,
        });

const routePath = z.string().min(1).max(512).regex(
    /^\/[A-Za-z0-9/_\-:.\[\]*]*$/,
    "Route path must start with / and use URL-safe characters",
);

const iconName = z.string().min(1).max(64).regex(SAFE_SLUG, "Icon must be a Lucide name");

const menuItem = z.object({
    label: z.string().min(1).max(100),
    path: routePath,
    icon: iconName.optional(),
});

const routeEntry = z.object({
    path: routePath,
    component: relativePath("component"),
    layout: relativePath("layout").optional(),
});

const adminRouteEntry = z.object({
    path: routePath,
    component: relativePath("component"),
});

const apiEntry = z.object({
    path: routePath,
    handler: relativePath("handler"),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "ALL"]).optional(),
    description: z.string().max(500).optional(),
});

const widgetEntry = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    component: relativePath("component"),
    defaultOrder: z.number().int(),
    defaultVisible: z.boolean(),
});

const navLink = z.object({
    label: z.string().min(1).max(100),
    href: routePath,
    icon: iconName.optional(),
    position: z.number().int().optional(),
});

const footerLink = z.object({
    label: z.string().min(1).max(100),
    href: routePath,
    section: z.enum(["quick", "legal"]).optional(),
});

const profileTab = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    label: z.string().min(1).max(100),
    component: relativePath("component"),
    order: z.number().int(),
});

const oauthButton = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    provider: z.string().min(1).max(64).regex(SAFE_SLUG),
    label: z.string().min(1).max(100),
    color: z.string().min(1).max(32),
    svgIcon: z.string().min(1).max(8192),
});

const navbarComponent = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    component: relativePath("component"),
    order: z.number().int(),
});

const footerComponent = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    component: relativePath("component"),
    section: z.string().max(64).optional(),
    order: z.number().int().optional(),
});

const storageProvider = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    name: z.string().min(1).max(100),
    handler: relativePath("handler"),
});

const contextProvider = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    component: relativePath("component"),
    order: z.number().int().optional(),
});

const hookListener = z.object({
    hook: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
    type: z.enum(["action", "filter"]),
    handler: relativePath("handler"),
    priority: z.number().int().optional(),
});

const slotContent = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    slot: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
    component: relativePath("component"),
    order: z.number().int().optional(),
});

const slotContribution = z.object({
    name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9.-]+$/),
    component: relativePath("component"),
    order: z.number().int().optional(),
    id: z.string().min(1).max(64).regex(SAFE_SLUG).optional(),
});

const pageBlock = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    category: z.string().max(64).optional(),
    component: relativePath("component"),
});

const cronJob = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    schedule: z.string().min(1).max(64),
    handler: relativePath("handler"),
});

const searchProvider = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    label: z.string().min(1).max(100),
    handler: relativePath("handler"),
});

const webhookReceiver = z
    .object({
        provider: z.string().min(1).max(64).regex(SAFE_SLUG),
        handler: relativePath("handler"),
        signatureHeader: z.string().max(128).optional(),
        secretEnv: z.string().max(128).regex(/^[A-Z0-9_]+$/).optional(),
        /**
         * Signals that the handler itself performs signature verification
         * (e.g. PayPal via REST API, Stripe via SDK). When false/omitted
         * and no signatureHeader/secretEnv pair is supplied, the dispatcher
         * refuses the request so a forgotten manifest field cannot
         * silently ship an unauthenticated webhook to production.
         */
        verifiesInHandler: z.boolean().optional(),
        /**
         * Header name that carries the sender's timestamp (Unix seconds,
         * Unix ms, or ISO-8601). When set, the dispatcher refuses any
         * request older than WEBHOOK_REPLAY_WINDOW_MS so a captured,
         * still-signed webhook can't be replayed forever. Pairs with HMAC
         * verification; meaningless without it.
         */
        timestampHeader: z.string().max(128).optional(),
    })
    .refine(
        (r) => Boolean(r.signatureHeader && r.secretEnv) || r.verifiesInHandler === true,
        {
            message:
                "webhookReceivers entry must either provide both signatureHeader+secretEnv for HMAC verification or set verifiesInHandler:true to take responsibility for its own signature check",
            path: ["signatureHeader"],
        },
    );

const notificationType = z.object({
    eventType: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
    label: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    channels: z.array(z.string().max(32)).optional(),
});

const layoutComponent = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    component: relativePath("component"),
    include: z.array(z.string().max(256)).optional(),
    exclude: z.array(z.string().max(256)).optional(),
});

const settingsCard = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500),
    href: routePath,
    icon: iconName,
    color: z.string().min(1).max(64),
});

const homepageSection = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    type: z.enum(["content", "widget"]),
    component: relativePath("component"),
    order: z.number().int(),
});

const dashboardCard = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    label: z.string().min(1).max(100),
    labelKey: z.string().max(128).optional(),
    icon: iconName,
    href: routePath,
    color: z.string().min(1).max(64),
    statKey: z.string().min(1).max(64).regex(SAFE_SLUG),
});

const userDataExportEntry = z.object({
    model: z.string().min(1).max(128).regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "model must be a Prisma delegate identifier"),
    key: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
    column: z.string().min(1).max(128).regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
});

type TranslationValue = string | { [key: string]: TranslationValue };
const translationValue: z.ZodType<TranslationValue> = z.lazy(() =>
    z.union([z.string(), z.record(z.string(), translationValue)]),
);
const translations = z.record(z.string(), z.record(z.string(), translationValue));

export const moduleManifestSchema = z.object({
    id: z.string().min(1).max(64).regex(SAFE_ID, "id must be lowercase alphanumeric + hyphens"),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    version: z.string().min(1).max(32).regex(/^\d+\.\d+\.\d+/, "version must be semver"),
    author: z.string().max(100).optional(),
    icon: iconName.optional(),
    permissions: z.array(z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/)).max(100).optional(),
    defaultConfig: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.array(z.string().regex(SAFE_ID)).max(50).optional(),
    conflicts: z.array(z.string().regex(SAFE_ID)).max(50).optional(),
    translations: translations.optional(),

    hooks: z.object({
        onEnable: relativePath("onEnable").optional(),
        onDisable: relativePath("onDisable").optional(),
    }).optional(),

    menu: z.array(menuItem).max(100).optional(),
    routes: z.array(routeEntry).max(200).optional(),
    adminRoutes: z.array(adminRouteEntry).max(200).optional(),
    api: z.array(apiEntry).max(500).optional(),
    widgets: z.array(widgetEntry).max(50).optional(),
    navLinks: z.array(navLink).max(50).optional(),
    footerLinks: z.array(footerLink).max(50).optional(),
    profileTabs: z.array(profileTab).max(50).optional(),
    oauthButtons: z.array(oauthButton).max(20).optional(),
    navbarComponents: z.array(navbarComponent).max(30).optional(),
    footerComponents: z.array(footerComponent).max(30).optional(),
    storageProviders: z.array(storageProvider).max(10).optional(),
    contextProviders: z.array(contextProvider).max(20).optional(),
    hookListeners: z.array(hookListener).max(200).optional(),
    slotContents: z.array(slotContent).max(100).optional(),
    slots: z.array(slotContribution).max(200).optional(),
    pageBlocks: z.array(pageBlock).max(100).optional(),
    cronJobs: z.array(cronJob).max(50).optional(),
    searchProviders: z.array(searchProvider).max(20).optional(),
    webhookReceivers: z.array(webhookReceiver).max(50).optional(),
    notificationTypes: z.array(notificationType).max(100).optional(),
    layoutComponents: z.array(layoutComponent).max(50).optional(),
    settingsCards: z.array(settingsCard).max(50).optional(),
    homepageSections: z.array(homepageSection).max(50).optional(),
    dashboardCards: z.array(dashboardCard).max(50).optional(),
    statsApi: routePath.optional(),
    seoRoutes: z.object({ handler: relativePath("handler") }).optional(),
    userDataExport: z.array(userDataExportEntry).max(50).optional(),
}).strict();

export type ValidatedModuleManifest = z.infer<typeof moduleManifestSchema>;

/**
 * Collects every `handler`/`component` path referenced by a manifest. Used
 * after ZIP extraction to verify that files the manifest claims actually exist.
 */
export function collectManifestFileRefs(m: ValidatedModuleManifest): string[] {
    const refs: string[] = [];
    const push = (v: string | undefined) => { if (v) refs.push(v); };

    m.routes?.forEach((r) => { push(r.component); push(r.layout); });
    m.adminRoutes?.forEach((r) => push(r.component));
    m.api?.forEach((r) => push(r.handler));
    m.widgets?.forEach((r) => push(r.component));
    m.profileTabs?.forEach((r) => push(r.component));
    m.navbarComponents?.forEach((r) => push(r.component));
    m.footerComponents?.forEach((r) => push(r.component));
    m.storageProviders?.forEach((r) => push(r.handler));
    m.contextProviders?.forEach((r) => push(r.component));
    m.hookListeners?.forEach((r) => push(r.handler));
    m.slotContents?.forEach((r) => push(r.component));
    m.slots?.forEach((s) => push(s.component));
    m.pageBlocks?.forEach((r) => push(r.component));
    m.cronJobs?.forEach((r) => push(r.handler));
    m.searchProviders?.forEach((r) => push(r.handler));
    m.webhookReceivers?.forEach((r) => push(r.handler));
    m.layoutComponents?.forEach((r) => push(r.component));
    m.homepageSections?.forEach((r) => push(r.component));
    push(m.hooks?.onEnable);
    push(m.hooks?.onDisable);
    push(m.seoRoutes?.handler);

    return [...new Set(refs)];
}
