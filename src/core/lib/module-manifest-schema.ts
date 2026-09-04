import { z } from "zod";
import { isValidRange } from "./semver-range";

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;

/**
 * A semver range the module declares it accepts. Validated eagerly so an
 * unparseable range is a manifest error rather than something that silently
 * fails every comparison at install time.
 */
const semverRange = z
    .string()
    .min(1)
    .max(64)
    .refine(isValidRange, { message: "must be a semver range (e.g. ^1.2.0, >=1.0.0 <2.0.0, 1.x)" });

/**
 * `id` or `id@range`. The range is optional so every manifest written before
 * the compatibility contract existed stays valid, and an entry without one
 * keeps the original meaning: any installed version will do.
 */
const DEPENDENCY_SPEC = /^([a-z0-9][a-z0-9-]*)(?:@(.+))?$/;
const dependencySpec = z
    .string()
    .min(1)
    .max(96)
    .superRefine((value, ctx) => {
        const m = DEPENDENCY_SPEC.exec(value);
        if (!m) {
            ctx.addIssue({ code: "custom", message: `"${value}" must be a module id, optionally suffixed with @range` });
            return;
        }
        if (m[2] !== undefined && !isValidRange(m[2])) {
            ctx.addIssue({ code: "custom", message: `"${m[2]}" is not a valid semver range in "${value}"` });
        }
    });

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

/**
 * A path inside the admin panel, written without the `/admin` prefix.
 *
 * Core adds the prefix (see `adminHref`), so a manifest that includes it too
 * produces `/admin/admin/...`: a link to a page that does not exist, from a
 * menu or a search result for one that does. Five first-party modules had it
 * that way and nothing said so, because only the spotlight ever built a URL
 * from `settingsCards[].href`.
 */
const panelRelativePath = routePath.refine(
    (p) => p !== "/admin" && !p.startsWith("/admin/"),
    { message: "Admin paths are relative to the panel: drop the leading /admin" },
);

const menuItem = z.object({
    label: z.string().min(1).max(100),
    path: panelRelativePath,
    icon: iconName.optional(),
    group: z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/).optional(),
});

const routeEntry = z.object({
    path: routePath,
    component: relativePath("component"),
    layout: relativePath("layout").optional(),
    /**
     * Keeps the page out of the sitemap and marks it `noindex` for crawlers.
     * For the pages that exist to be walked through rather than found: a cart,
     * an order confirmation, anything whose content belongs to one visitor.
     */
    noindex: z.boolean().optional(),
    /**
     * Lets core title the page from the last URL segment.
     *
     * Only true where the page resolves the resource on the server and calls
     * `notFound()` when there is none, because then a URL that names nothing
     * answers 404 and the title never ships. A page that answers 200 and
     * renders "not found" in the browser hands the visitor the site's own
     * `<title>` and `og:title`, which is what an unfurled link shows in chat.
     * `validate-module` checks the page really is that shape.
     */
    titleFromPath: z.boolean().optional(),
});

const adminRouteEntry = z.object({
    path: panelRelativePath,
    component: relativePath("component"),
});

const apiEntry = z.object({
    path: routePath,
    handler: relativePath("handler"),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "ALL"]).optional(),
    description: z.string().max(500).optional(),
    /**
     * An endpoint a payment provider or other external service posts to
     * directly, with no browser and therefore no `Origin` header.
     *
     * The proxy's CSRF gate rejects exactly that shape, so every gateway
     * webhook was answered 403 before its handler ran and no payment ever
     * settled. Core cannot know a module's callback paths - the gate's
     * hardcoded `/api/v1/webhook/` prefix only ever matched core's own route -
     * so the module declares them and the proxy reads the declaration.
     *
     * The exemption is only safe because such a handler authenticates the
     * request itself: a signature it verifies, or reading the payment back
     * from the provider with this site's own credentials. `validate-module`
     * fails a `providerCallback` whose handler does neither.
     */
    providerCallback: z.boolean().optional(),
});

const widgetEntry = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    component: relativePath("component"),
    defaultOrder: z.number().int(),
    defaultVisible: z.boolean(),
});

// `label` is the fallback shown when the key is missing; `labelKey` is what
// the navbar, footer and mobile bar actually render, resolved in the `nav`
// namespace. Without it a module's most visible string - its own name in the
// navigation - stayed English in every locale, next to a translated "Home".
const navLink = z.object({
    label: z.string().min(1).max(100),
    labelKey: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    href: routePath,
    icon: iconName.optional(),
    position: z.number().int().optional(),
});

const footerLink = z.object({
    label: z.string().min(1).max(100),
    labelKey: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/).optional(),
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
    /**
     * Send the visitor here instead of calling `signIn(provider)`.
     *
     * Auth.js starts a login by POSTing to its own signin endpoint, which
     * suits OAuth2 and nothing else. A provider that opens its flow some
     * other way - Steam hands you an OpenID 2.0 redirect - points the button
     * at its own entry route instead. Same-origin only: an absolute URL here
     * would let a manifest aim the sign-in button at any site it likes, and
     * so would a protocol-relative one, which is why a second leading slash
     * is rejected too.
     */
    href: z
        .string()
        .min(1)
        .max(200)
        .regex(
            /^\/(?![/\\])[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/,
            "href must be a same-origin path starting with a single /",
        )
        .optional(),
});

const navGroup = z.object({
    id: z.string().min(1).max(64).regex(SAFE_ID, "Nav group id must be a lowercase slug"),
    label: z.string().min(1).max(64),
    icon: iconName.optional(),
    order: z.number().int().min(0).max(9999).optional(),
});

// A channel id is stored in settings and matched against this list, so it is
// held to the same slug rule as other registry keys.
const webhookChannel = z.object({
    id: z.string().min(1).max(64).regex(SAFE_ID, "Webhook channel id must be a lowercase slug"),
    label: z.string().min(1).max(64),
    layout: z.enum(["json", "embed", "attachment"]),
    // Hostnames the admin's webhook URL must match. Omitted means core applies
    // its own conservative rule instead of a per-vendor allowlist.
    hosts: z.array(z.string().min(1).max(253)).max(10).optional(),
    urlPlaceholder: z.string().max(300).optional(),
});
// The provider id is interpolated into a `next-auth/providers/<id>` import, so
// it is held to the strict slug rule rather than the looser SAFE_SLUG used for
// display-only ids - a "/" or ".." here would escape the providers directory.
const ENV_VAR_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * An identity provider a module contributes to the sign-in page.
 *
 * Two shapes, and which one you get depends on whether Auth.js already ships
 * the provider:
 *
 * - **Built in.** Give `envIdVar` and `envSecretVar`. The id resolves as
 *   `next-auth/providers/<id>` and receives exactly a client id and secret.
 *   This covers every ordinary OAuth2 login.
 * - **Module supplied.** Give `factory` and `envVars`. The module ships the
 *   provider itself, from a file in its own tree, and names the env vars it
 *   needs. This is the only way to reach an identity system Auth.js does not
 *   ship - Steam speaks OpenID 2.0, not OAuth2 - and it is also the way to
 *   configure a built-in that needs more than two credentials, such as
 *   Battle.net's required region issuer or Apple's signed-JWT secret.
 *
 * Either way the provider stays inactive until every env var it names is set,
 * so an installed but unconfigured module contributes nothing.
 */
const authProvider = z
    .object({
        id: z.string().min(1).max(64).regex(SAFE_ID, "Auth provider id must be a lowercase slug"),
        envIdVar: z.string().min(1).max(128).regex(ENV_VAR_NAME, "envIdVar must be an env var name").optional(),
        envSecretVar: z
            .string()
            .min(1)
            .max(128)
            .regex(ENV_VAR_NAME, "envSecretVar must be an env var name")
            .optional(),
        /** Module-relative path to a file whose default export builds the provider. */
        factory: relativePath("factory").optional(),
        /**
         * Set when a module-supplied provider is an ordinary Auth.js OAuth
         * provider - built here only because it needs more than a client id and
         * secret - so its redirect URL is the usual `/api/auth/callback/<id>`
         * and the admin panel can show it. A provider whose flow runs in the
         * module's own routes leaves this off and documents its URLs itself.
         */
        standardCallback: z.boolean().optional(),
        /** Env vars a module-supplied provider needs. All must be set for it to activate. */
        envVars: z
            .array(z.string().min(1).max(128).regex(ENV_VAR_NAME, "envVars entries must be env var names"))
            .min(1)
            .max(10)
            .optional(),
    })
    .superRefine((value, ctx) => {
        if (value.factory) {
            if (!value.envVars) {
                ctx.addIssue({
                    code: "custom",
                    message: "an auth provider with a factory must also declare envVars",
                });
            }
            if (value.envIdVar || value.envSecretVar) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "an auth provider with a factory takes its credentials from envVars, " +
                        "not envIdVar/envSecretVar",
                });
            }
            return;
        }
        if (value.envVars) {
            ctx.addIssue({ code: "custom", message: "envVars only applies to an auth provider with a factory" });
        }
        if (value.standardCallback !== undefined) {
            ctx.addIssue({
                code: "custom",
                message:
                    "standardCallback only applies to an auth provider with a factory - a built-in " +
                    "provider already uses the standard callback URL",
            });
        }
        if (!value.envIdVar || !value.envSecretVar) {
            ctx.addIssue({
                code: "custom",
                message: "an auth provider without a factory needs both envIdVar and envSecretVar",
            });
        }
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

const HOOK_NAME = /^[a-zA-Z0-9._-]+$/;

const hookListener = z.object({
    hook: z.string().min(1).max(128).regex(HOOK_NAME),
    type: z.enum(["action", "filter"]),
    handler: relativePath("handler"),
    priority: z.number().int().optional(),
});

/**
 * A hook this module fires. Declaring it makes the module's half of the
 * cross-module contract inspectable: `validate:module` checks the declaration
 * against the `doAction`/`applyFilters` calls in the source, and the
 * marketplace build rejects a `hookListeners` entry naming a hook no module in
 * the catalog emits - which is the only thing that can catch a typo in a hook
 * name, since nothing fails at runtime when a listener never fires.
 */
const hookEmitted = z.object({
    hook: z.string().min(1).max(128).regex(HOOK_NAME),
    type: z.enum(["action", "filter"]),
    description: z.string().max(200).optional(),
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

/**
 * A full-text index the module needs on one of its own tables.
 *
 * Modules declare identifiers, never SQL. Core builds the `to_tsvector(...)`
 * expression from them, so a module cannot inject anything into the DDL - and
 * the regex below is what makes that guarantee hold rather than assume it.
 */
const searchIndex = z.object({
    table: z.string().min(1).max(63).regex(/^[A-Za-z][A-Za-z0-9_]*$/, "table must be a plain SQL identifier"),
    columns: z
        .array(z.string().min(1).max(63).regex(/^[A-Za-z][A-Za-z0-9_]*$/, "column must be a plain SQL identifier"))
        .min(1)
        .max(10),
});

const searchProvider = z.object({
    id: z.string().min(1).max(64).regex(SAFE_SLUG),
    label: z.string().min(1).max(100),
    handler: relativePath("handler"),
    icon: iconName.optional(),
    /**
     * Core used to carry a hardcoded list of four module tables in
     * `scripts/ensure-search-indexes.ts` - `BlogArticle`, `ForumTopic`,
     * `HelpArticle`, `Product` - which is exactly the coupling the project
     * forbids, and which logged an error for every uninstalled module on
     * every boot. The module that owns the table declares the index instead.
     */
    indexes: z.array(searchIndex).max(5).optional(),
});

const activityTitle = z.object({
    type: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
    prefix: z.string().max(128),
    key: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
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
    href: panelRelativePath,
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

const moderationProvider = z.object({
    id: z.string().min(1).max(64).regex(SAFE_ID, "id must be lowercase alphanumeric + hyphens"),
    label: z.string().min(1).max(100),
    labelKey: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    settingKey: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/).optional(),
    settingLabelKey: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    settingDescKey: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    handler: relativePath("handler"),
});

type TranslationValue = string | { [key: string]: TranslationValue };
const translationValue: z.ZodType<TranslationValue> = z.lazy(() =>
    z.union([z.string(), z.record(z.string(), translationValue)]),
);
const translations = z.record(z.string(), z.record(z.string(), translationValue));

/**
 * External origins a module needs the Content-Security-Policy to allow.
 *
 * Core's CSP is one fixed list, and it used to carry payment gateway origins
 * by name - which is core knowing about modules, and was wrong twice over,
 * since neither gateway ever loaded them and three features that did need an
 * origin were blocked. The Discord widget's iframe and the Google Analytics
 * tag both rendered nothing, with no error anywhere but the browser console.
 *
 * A module may only widen the fetch directives, and only with a concrete
 * https origin. Keywords are refused outright: `'unsafe-inline'`,
 * `'unsafe-eval'`, `*`, `data:` and a bare scheme would let one module undo
 * the policy for every page on the site.
 */
const CSP_ORIGIN = z
    .string()
    .min(1)
    .max(253)
    .regex(
        /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/,
        "must be a concrete https origin, e.g. https://discord.com",
    );

const cspContribution = z
    .object({
        "script-src": z.array(CSP_ORIGIN).max(10).optional(),
        "frame-src": z.array(CSP_ORIGIN).max(10).optional(),
        "connect-src": z.array(CSP_ORIGIN).max(10).optional(),
        "img-src": z.array(CSP_ORIGIN).max(10).optional(),
        "style-src": z.array(CSP_ORIGIN).max(10).optional(),
        "font-src": z.array(CSP_ORIGIN).max(10).optional(),
        "media-src": z.array(CSP_ORIGIN).max(10).optional(),
    })
    .strict();

export const moduleManifestSchema = z.object({
    id: z.string().min(1).max(64).regex(SAFE_ID, "id must be lowercase alphanumeric + hyphens"),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    version: z.string().min(1).max(32).regex(/^\d+\.\d+\.\d+/, "version must be semver"),
    author: z.string().max(100).optional(),
    icon: iconName.optional(),
    permissions: z.array(z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/)).max(100).optional(),
    defaultConfig: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.array(dependencySpec).max(50).optional(),
    conflicts: z.array(dependencySpec).max(50).optional(),
    /**
     * Range of CORE_API_VERSION this module was built against.
     *
     * Required. It used to be optional, and an omitted range meant
     * "unconstrained" - which is the one answer a compatibility gate must
     * never accept by default: a module built against a core it has never
     * seen installed silently and failed at runtime instead of at install
     * time. Declaring the range is one line, and getting it wrong is a clear
     * error message; guessing on the module's behalf is neither.
     */
    coreVersion: semverRange,
    /**
     * Marketplace grouping. Free-form rather than a fixed enum so core owns no
     * category vocabulary - the catalog groups by whatever values are present.
     */
    category: z.string().min(1).max(32).regex(SAFE_ID, "category must be a lowercase slug").optional(),
    tags: z.array(z.string().min(1).max(32)).max(10).optional(),
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
    navGroups: z.array(navGroup).max(20).optional(),
    authProviders: z.array(authProvider).max(20).optional(),
    webhookChannels: z.array(webhookChannel).max(20).optional(),
    navbarComponents: z.array(navbarComponent).max(30).optional(),
    footerComponents: z.array(footerComponent).max(30).optional(),
    storageProviders: z.array(storageProvider).max(10).optional(),
    contextProviders: z.array(contextProvider).max(20).optional(),
    hookListeners: z.array(hookListener).max(200).optional(),
    hooksEmitted: z.array(hookEmitted).max(200).optional(),
    slotContents: z.array(slotContent).max(100).optional(),
    slots: z.array(slotContribution).max(200).optional(),
    pageBlocks: z.array(pageBlock).max(100).optional(),
    cronJobs: z.array(cronJob).max(50).optional(),
    searchProviders: z.array(searchProvider).max(20).optional(),
    activityTitles: z.array(activityTitle).max(50).optional(),
    permissionResources: z.array(z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/)).max(100).optional(),
    webhookReceivers: z.array(webhookReceiver).max(50).optional(),
    notificationTypes: z.array(notificationType).max(100).optional(),
    layoutComponents: z.array(layoutComponent).max(50).optional(),
    settingsCards: z.array(settingsCard).max(50).optional(),
    homepageSections: z.array(homepageSection).max(50).optional(),
    dashboardCards: z.array(dashboardCard).max(50).optional(),
    statsApi: routePath.optional(),
    seoRoutes: z.object({ handler: relativePath("handler") }).optional(),
    userDataExport: z.array(userDataExportEntry).max(50).optional(),
    moderationProviders: z.array(moderationProvider).max(20).optional(),
    csp: cspContribution.optional(),
}).strict();

export type ValidatedModuleManifest = z.infer<typeof moduleManifestSchema>;

/**
 * Collects every `handler`/`component` path referenced by a manifest. Used
 * after ZIP extraction to verify that files the manifest claims actually exist.
 */
/**
 * The file extensions a manifest ref may be written without. The registry
 * generator strips any extension off a ref and emits a bare import specifier
 * (`@/modules/blog/components/BlogNewsSection`), leaving the bundler to pick
 * the file - so `components/Foo`, `components/Foo.tsx` and `components/Foo/`
 * all name the same module. Anything that validates refs against the disk has
 * to apply the same rule or it rejects manifests the build would have loaded
 * fine.
 */
const MODULE_REF_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"];

/**
 * Every on-disk path a single manifest ref may legitimately resolve to, in the
 * order a resolver should try them: the literal path first (a ref that already
 * carries its extension), then each extension appended, then `index.*` inside
 * a directory of that name.
 *
 * Pure - no filesystem access - so this stays importable from the client
 * bundle alongside the rest of the schema. `checkManifestFileRefs` in
 * `module-ref-resolver.ts` is the filesystem-aware half.
 */
export function manifestRefCandidates(ref: string): string[] {
    const cleaned = ref.replace(/^\.\//, "").replace(/\/+$/, "");
    const base = cleaned.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, "");
    const candidates = [cleaned];
    for (const ext of MODULE_REF_EXTENSIONS) candidates.push(base + ext);
    for (const ext of MODULE_REF_EXTENSIONS) candidates.push(`${base}/index${ext}`);
    return [...new Set(candidates)];
}

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
    m.moderationProviders?.forEach((r) => push(r.handler));
    m.authProviders?.forEach((r) => push(r.factory));

    return [...new Set(refs)];
}
