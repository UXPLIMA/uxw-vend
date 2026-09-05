/**
 * Generate the OpenAPI 3.0 spec that /admin/api-docs renders.
 *
 * Every operation in the spec is discovered from code that exists:
 *
 *   - Core operations come from the verbs each `src/app/api/**\/route.ts`
 *     actually exports.
 *   - Module operations come from the verbs each declared handler exports,
 *     with the manifest's `method` as the fallback when the file cannot be
 *     read.
 *
 * CORE_ENDPOINT_DOCS below adds prose - a summary, a request body, the
 * response codes - to operations that have it. It cannot add an operation:
 * an entry naming a path and verb no route exports is a build error.
 *
 * It used to work the other way round. The core half was a hand-written list
 * of twenty-nine operations against a real surface of a hundred and
 * thirty-five, and two of the twenty-nine did not exist: `POST
 * /api/v1/auth/login`, which is the first call anyone integrating writes and
 * which 404s because sign-in goes through Auth.js, and `DELETE
 * /api/v1/users/{id}`, which no file exports. The module half guessed: an
 * entry with no explicit `method` was published as GET and POST, so
 * thirty-nine of sixty-three installed endpoints were documented with verbs
 * they reject while the DELETE and PATCH they do accept went unmentioned.
 *
 * Runs as part of `prebuild`. Can also be invoked manually:
 *   npx tsx scripts/generate-openapi.ts
 */

import fs from "fs";
import path from "path";
import { exportedHttpMethods } from "../src/core/lib/http-methods";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
const CORE_API_DIR = path.join(process.cwd(), "src/app/api");
const OUTPUT_FILE = path.join(
    process.cwd(),
    "src/core/generated/openapi.json",
);

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface OpenApiOperation {
    summary: string;
    description?: string;
    tags: string[];
    security?: { bearerAuth: [] }[];
    parameters?: {
        name: string;
        in: "path" | "query";
        required: boolean;
        schema: { type: string };
    }[];
    requestBody?: {
        content: {
            "application/json": {
                schema: {
                    type: "object";
                    properties?: Record<string, { type: string }>;
                    required?: string[];
                };
            };
        };
    };
    responses: Record<string, { description: string }>;
}

type PathItem = Partial<Record<HttpMethod, OpenApiOperation>>;

interface ModuleApiEntry {
    path: string;
    handler: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";
    description?: string;
}

interface ModuleManifestLite {
    id: string;
    name: string;
    description?: string;
    api?: ModuleApiEntry[];
}

interface CoreEndpoint {
    path: string;
    method: HttpMethod;
    summary: string;
    description?: string;
    tags: string[];
    secured?: boolean;
    parameters?: OpenApiOperation["parameters"];
    requestBody?: OpenApiOperation["requestBody"];
    responses?: OpenApiOperation["responses"];
}

/**
 * Prose for core operations that deserve more than their path and verb.
 * Every entry must name a route that exports that verb; `generate()` exits if
 * one does not. Operations with no entry here are still published, with a
 * summary built from the method and the path.
 */
const CORE_ENDPOINT_DOCS: CoreEndpoint[] = [
    // --- Auth ---
    {
        // Sign-in is Auth.js, not a core route: this is where the credentials
        // actually go. The list used to claim `/api/v1/auth/login`, which no
        // file has ever exported.
        path: "/api/auth/{nextauth}",
        method: "post",
        summary: "Sign in, sign out, callback, session (Auth.js)",
        description: "Authenticate a user with email/username and password; returns a session cookie and enforces 2FA when enabled. The trailing segment selects the Auth.js action, e.g. `callback/credentials`.",
        tags: ["Auth"],
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            email: { type: "string" },
                            password: { type: "string" },
                        },
                        required: ["email", "password"],
                    },
                },
            },
        },
        responses: {
            "200": { description: "Logged in" },
            "401": { description: "Invalid credentials" },
        },
    },
    {
        path: "/api/v1/auth/register",
        method: "post",
        summary: "Register new user",
        description: "Create a new user account with email, username and password; validates input with Zod and hashes credentials with bcrypt.",
        tags: ["Auth"],
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            email: { type: "string" },
                            username: { type: "string" },
                            password: { type: "string" },
                            confirmPassword: { type: "string" },
                        },
                        required: [
                            "email",
                            "username",
                            "password",
                            "confirmPassword",
                        ],
                    },
                },
            },
        },
        responses: {
            "201": { description: "User created" },
            "400": { description: "Validation error" },
        },
    },
    {
        path: "/api/v1/auth/forgot-password",
        method: "post",
        summary: "Request password reset email",
        description: "Initiate password recovery by emailing a time-limited reset token to the account on file.",
        tags: ["Auth"],
        responses: { "200": { description: "Reset email sent" } },
    },
    {
        path: "/api/v1/auth/reset-password",
        method: "post",
        summary: "Reset password with token",
        description: "Consume a password reset token and set a new password for the associated user.",
        tags: ["Auth"],
        responses: { "200": { description: "Password reset" } },
    },
    {
        path: "/api/v1/auth/profile",
        method: "get",
        summary: "Get current user profile",
        description: "Return the authenticated user's profile, including display fields and preferences.",
        tags: ["Auth"],
        secured: true,
        responses: { "200": { description: "Profile data" } },
    },
    {
        path: "/api/v1/auth/profile",
        method: "patch",
        summary: "Update current user profile",
        description: "Update the authenticated user's own profile fields (name, bio, avatar, preferences).",
        tags: ["Auth"],
        secured: true,
        responses: { "200": { description: "Updated" } },
    },

    // --- Users ---
    {
        path: "/api/v1/users",
        method: "get",
        summary: "List users (admin)",
        description: "Return a paginated list of users with their roles; requires admin permissions.",
        tags: ["Users"],
        secured: true,
        responses: { "200": { description: "User list" } },
    },
    {
        path: "/api/v1/users/{id}",
        method: "get",
        summary: "Get user by id (admin)",
        description: "Fetch a single user's full record by ID, including role and profile data.",
        tags: ["Users"],
        secured: true,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
        ],
        responses: { "200": { description: "User object" } },
    },
    {
        path: "/api/v1/users/{id}",
        method: "patch",
        summary: "Update user (admin)",
        description: "Update a user's fields (role, status, profile) as an administrator.",
        tags: ["Users"],
        secured: true,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
        ],
        responses: { "200": { description: "Updated" } },
    },

    // --- Roles ---
    {
        path: "/api/v1/roles",
        method: "get",
        summary: "List roles",
        description: "Return all roles defined in the platform along with their priority and permission assignments.",
        tags: ["Roles"],
        secured: true,
        responses: { "200": { description: "Role list" } },
    },
    {
        path: "/api/v1/roles",
        method: "post",
        summary: "Create role (admin)",
        description: "Create a new RBAC role with a name, priority and initial permission set.",
        tags: ["Roles"],
        secured: true,
        responses: { "201": { description: "Role created" } },
    },

    // --- Modules ---
    {
        path: "/api/v1/modules",
        method: "get",
        summary: "List modules (admin)",
        description: "Return all installed modules with their manifest metadata and enabled state.",
        tags: ["Modules"],
        secured: true,
        responses: { "200": { description: "Module list" } },
    },
    {
        path: "/api/v1/modules",
        method: "patch",
        summary: "Enable/disable module (admin)",
        description: "Toggle a module's enabled state at runtime without uninstalling its files.",
        tags: ["Modules"],
        secured: true,
        responses: { "200": { description: "Updated" } },
    },
    {
        path: "/api/v1/modules/marketplace/install",
        method: "post",
        summary: "Install module from marketplace (admin)",
        description: "Download, extract and register a verified marketplace module, then regenerate the module registry and merged Prisma schema.",
        tags: ["Modules"],
        secured: true,
        responses: { "200": { description: "Installed" } },
    },

    // --- Settings ---
    {
        path: "/api/v1/settings",
        method: "get",
        summary: "Get settings (admin)",
        description: "Return all platform settings (site metadata, branding, navigation, feature flags) for admin editing.",
        tags: ["Settings"],
        secured: true,
        responses: { "200": { description: "Settings" } },
    },
    {
        path: "/api/v1/settings",
        method: "patch",
        summary: "Update settings (admin)",
        description: "Upsert one or more platform setting key/value pairs and invalidate the public settings cache.",
        tags: ["Settings"],
        secured: true,
        responses: { "200": { description: "Updated" } },
    },
    {
        path: "/api/v1/public-settings",
        method: "get",
        summary: "Get public settings",
        description: "Return the subset of settings safe for unauthenticated clients (site name, logo, hero config, etc.).",
        tags: ["Settings"],
        responses: { "200": { description: "Public settings" } },
    },

    // --- Media / uploads ---
    {
        path: "/api/v1/upload",
        method: "post",
        summary: "Upload file",
        description: "Accept a multipart file upload, validate its size and MIME type, persist it to media storage and return its public URL.",
        tags: ["Media"],
        secured: true,
        responses: {
            "200": { description: "Uploaded file metadata" },
            "413": { description: "File too large" },
        },
    },
    {
        path: "/api/v1/media",
        method: "get",
        summary: "List media library entries (admin)",
        description: "Return a paginated list of media library assets uploaded to the platform.",
        tags: ["Media"],
        secured: true,
        responses: { "200": { description: "Media list" } },
    },

    // --- Search ---
    {
        path: "/api/v1/search",
        method: "get",
        summary: "Global search across enabled module search providers",
        description: "Run a federated search query against every enabled module that registers a search provider and return merged results.",
        tags: ["Search"],
        parameters: [
            {
                name: "q",
                in: "query",
                required: true,
                schema: { type: "string" },
            },
        ],
        responses: { "200": { description: "Search results" } },
    },

    // --- API Keys ---
    {
        path: "/api/v1/api-keys",
        method: "get",
        summary: "List API keys (admin)",
        description: "Return all issued API keys with metadata (name, scopes, last used) but never the raw secret.",
        tags: ["API Keys"],
        secured: true,
        responses: { "200": { description: "API key list" } },
    },
    {
        path: "/api/v1/api-keys",
        method: "post",
        summary: "Create API key (admin)",
        description: "Generate a new API key with scoped permissions; the raw secret is returned exactly once in the response.",
        tags: ["API Keys"],
        secured: true,
        responses: { "201": { description: "Created" } },
    },

    // --- System ---
    {
        path: "/api/health",
        method: "get",
        summary: "Health check",
        description: "Liveness and readiness probe that verifies database connectivity and returns service health.",
        tags: ["System"],
        responses: {
            "200": { description: "Healthy" },
            "503": { description: "Degraded" },
        },
    },
    {
        path: "/api/v1/admin/metrics",
        method: "get",
        summary: "Request metrics (admin)",
        description: "Return in-memory request metrics (per-route counts, latency buckets, error rates) for the admin dashboard.",
        tags: ["System"],
        secured: true,
        responses: { "200": { description: "Metrics" } },
    },
    {
        path: "/api/v1/admin/system",
        method: "get",
        summary: "System health info (admin)",
        description: "Return detailed system information including Node version, memory usage, uptime and environment details.",
        tags: ["System"],
        secured: true,
        responses: { "200": { description: "System info" } },
    },
    {
        path: "/api/v1/admin/backup",
        method: "get",
        summary: "List backups (admin)",
        description: "Return all database backup archives currently stored on disk with their size and creation timestamp.",
        tags: ["System"],
        secured: true,
        responses: { "200": { description: "Backup list" } },
    },
    {
        path: "/api/v1/admin/backup",
        method: "post",
        summary: "Create backup (admin)",
        description: "Trigger a new database backup dump and write the archive to the backups directory.",
        tags: ["System"],
        secured: true,
        responses: { "201": { description: "Backup created" } },
    },

    // --- Stats ---
    {
        path: "/api/v1/stats",
        method: "get",
        summary: "Dashboard statistics (admin)",
        description: "Aggregate statistics for the admin dashboard combining core counters and registered module statsApi contributions.",
        tags: ["Stats"],
        secured: true,
        responses: { "200": { description: "Stats payload" } },
    },
];

/** One operation some file in this repository actually exports. */
interface DiscoveredOperation {
    path: string;
    method: HttpMethod;
    file: string;
    secured: boolean;
}

/** The same reader the dispatcher's route table is built with, lowercased. */
function exportedMethods(source: string): HttpMethod[] {
    return exportedHttpMethods(source).map((m) => m.toLowerCase() as HttpMethod);
}

/**
 * Whether the handler refuses an anonymous caller. Read off the source rather
 * than declared, because a `secured: true` that nobody checks is the same
 * class of claim this whole file exists to stop making.
 */
function looksSecured(source: string): boolean {
    // No trailing \b: `auth()` ends in `)` and the `;` after it is not a word
    // character either, so the boundary never matched and the only endpoint
    // guarded by `await auth()` alone was published as open.
    return /\bauth\(\)/.test(source) || /\b(isAdmin|requireAdmin|requireApiKey|authenticateApiKey|getServerSession)\b/.test(source);
}

/**
 * The module dispatcher. Its five verbs stand for every installed module's
 * routes, which are published from the manifests instead, so publishing the
 * wildcard as well would document one path that swallows two hundred.
 */
const NOT_AN_OPERATION = ["/api/v1/{path}"];

/** Every operation core exports, discovered from the route files. */
function discoverCoreOperations(): DiscoveredOperation[] {
    const out: DiscoveredOperation[] = [];
    const walk = (dir: string, url: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full, `${url}/${entry.name}`);
                continue;
            }
            if (entry.name !== "route.ts") continue;
            const openApiPath = url
                .replace(/\[\.\.\.(.+?)\]/g, "{$1}")
                .replace(/\[(.+?)\]/g, "{$1}");
            if (NOT_AN_OPERATION.includes(openApiPath)) continue;
            const source = fs.readFileSync(full, "utf8");
            const secured = looksSecured(source);
            for (const method of exportedMethods(source)) {
                out.push({ path: openApiPath, method, file: path.relative(process.cwd(), full), secured });
            }
        }
    };
    walk(CORE_API_DIR, "/api");
    return out;
}

/** Which group an undocumented core operation is filed under. */
function tagFor(url: string): string {
    const rules: [RegExp, string][] = [
        [/^\/api\/auth\//, "Auth"],
        [/^\/api\/v1\/auth\//, "Auth"],
        [/^\/api\/v1\/admin\//, "Admin"],
        [/^\/api\/v1\/users\b/, "Users"],
        [/^\/api\/v1\/(roles|permissions|resource-permissions)\b/, "Roles"],
        [/^\/api\/v1\/modules\b/, "Modules"],
        [/^\/api\/v1\/(settings|public-settings|themes)\b/, "Settings"],
        [/^\/api\/v1\/(media|upload)\b/, "Media"],
        [/^\/api\/v1\/search\b/, "Search"],
        [/^\/api\/v1\/api-keys\b/, "API Keys"],
        [/^\/api\/v1\/stats\b/, "Stats"],
        [/^\/api\/(health|v1\/(metrics|cron|backup))\b/, "System"],
    ];
    for (const [pattern, tag] of rules) if (pattern.test(url)) return tag;
    return "Core";
}

// Read installed modules from disk (mirrors generate-registry.ts approach).
function loadModules(): ModuleManifestLite[] {
    if (!fs.existsSync(MODULES_DIR)) return [];

    const dirs = fs
        .readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    const modules: ModuleManifestLite[] = [];
    for (const name of dirs) {
        const manifestPath = path.join(MODULES_DIR, name, "module.json");
        if (!fs.existsSync(manifestPath)) continue;
        try {
            const raw = fs.readFileSync(manifestPath, "utf8");
            const manifest = JSON.parse(raw) as ModuleManifestLite;
            modules.push(manifest);
        } catch (e) {
            console.error(
                `[openapi] Failed to parse manifest for ${name}:`,
                e,
            );
        }
    }
    return modules;
}

// Convert a Next.js-style path segment like /blog/articles/[id] to
// the OpenAPI-style /blog/articles/{id}.
function normalizePath(modulePath: string): string {
    const prefixed = modulePath.startsWith("/")
        ? `/api/v1${modulePath}`
        : `/api/v1/${modulePath}`;
    // Convert [param] and [...catchall] -> {param}
    return prefixed
        .replace(/\[\.\.\.(.+?)\]/g, "{$1}")
        .replace(/\[(.+?)\]/g, "{$1}");
}

/**
 * The verbs a module endpoint really answers.
 *
 * A manifest's `method` is optional and sixty of the sixty-three installed
 * entries omit it, which used to be published as "GET and POST" - a guess
 * that was wrong for thirty-nine of them, advertising verbs the handler
 * rejects while leaving out every DELETE and PATCH it accepts. The handler
 * file says which verbs it exports, so read it; the manifest is the fallback
 * for a handler that cannot be read.
 */
function methodsForModuleEntry(
    moduleDir: string,
    entry: ModuleApiEntry,
): HttpMethod[] {
    const handler = path.join(moduleDir, entry.handler.replace(/^\.?\//, ""));
    if (fs.existsSync(handler)) {
        const exported = exportedMethods(fs.readFileSync(handler, "utf8"));
        if (exported.length > 0) return exported;
    }
    if (entry.method && entry.method !== "ALL") return [entry.method.toLowerCase() as HttpMethod];
    console.warn(`[openapi] ${entry.path}: no verbs found in ${entry.handler}, publishing GET`);
    return ["get"];
}

function buildPathsFromModules(
    modules: ModuleManifestLite[],
): Record<string, PathItem> {
    const paths: Record<string, PathItem> = {};

    for (const mod of modules) {
        if (!mod.api) continue;
        for (const entry of mod.api) {
            const openApiPath = normalizePath(entry.path);
            const methods = methodsForModuleEntry(path.join(MODULES_DIR, mod.id), entry);

            if (!paths[openApiPath]) paths[openApiPath] = {};
            const pathItem = paths[openApiPath];

            // Extract {param} placeholders to declare path parameters.
            const paramMatches = Array.from(
                openApiPath.matchAll(/\{(.+?)\}/g),
            ).map((m) => m[1]);

            const parameters = paramMatches.length
                ? paramMatches.map((name) => ({
                      name,
                      in: "path" as const,
                      required: true,
                      schema: { type: "string" },
                  }))
                : undefined;

            for (const method of methods) {
                // Don't stomp an existing explicit method entry.
                if (pathItem[method]) continue;
                pathItem[method] = {
                    summary:
                        entry.description ||
                        `${mod.name} - ${entry.path}`,
                    description: `Module: ${mod.id}`,
                    tags: [mod.id],
                    security: [{ bearerAuth: [] }],
                    parameters,
                    responses: {
                        "200": { description: "Success" },
                        "401": { description: "Unauthorized" },
                    },
                };
            }
        }
    }

    return paths;
}

/** Path parameters read straight out of the URL template. */
function pathParameters(url: string): OpenApiOperation["parameters"] {
    const names = Array.from(url.matchAll(/\{(.+?)\}/g)).map((m) => m[1]);
    if (names.length === 0) return undefined;
    return names.map((name) => ({
        name,
        in: "path" as const,
        required: true,
        schema: { type: "string" },
    }));
}

/**
 * The core half of the spec: one operation per exported verb, with the prose
 * from CORE_ENDPOINT_DOCS layered on where there is any. Exits if a doc entry
 * names an operation no route exports - that is how the two dead entries got
 * to ship, and it must not be possible again.
 */
function buildPathsFromCore(operations: DiscoveredOperation[]): Record<string, PathItem> {
    const docs = new Map<string, CoreEndpoint>();
    for (const ep of CORE_ENDPOINT_DOCS) docs.set(`${ep.method} ${ep.path}`, ep);

    const real = new Set(operations.map((op) => `${op.method} ${op.path}`));
    const dead = [...docs.keys()].filter((k) => !real.has(k));
    if (dead.length > 0) {
        console.error(
            `[openapi] ${dead.length} documented operation(s) that no route exports:\n  ` +
                dead.map((d) => d.replace(/^(\w+) /, (_, verb) => `${verb.toUpperCase()} `)).join("\n  ") +
                "\nRemove the entry, or add the handler.",
        );
        process.exit(1);
    }

    const paths: Record<string, PathItem> = {};
    for (const operation of operations) {
        const doc = docs.get(`${operation.method} ${operation.path}`);
        const op: OpenApiOperation = {
            summary: doc?.summary ?? `${operation.method.toUpperCase()} ${operation.path}`,
            tags: doc?.tags ?? [tagFor(operation.path)],
            responses: doc?.responses ?? { "200": { description: "Success" } },
        };
        if (doc?.description) op.description = doc.description;
        // Declared beats detected, but detection is what covers the
        // operations nobody wrote an entry for.
        if (doc ? doc.secured : operation.secured) op.security = [{ bearerAuth: [] }];
        const parameters = doc?.parameters ?? pathParameters(operation.path);
        if (parameters) op.parameters = parameters;
        if (doc?.requestBody) op.requestBody = doc.requestBody;

        if (!paths[operation.path]) paths[operation.path] = {};
        paths[operation.path][operation.method] = op;
    }
    return paths;
}

function generate() {
    const modules = loadModules();
    const coreOperations = discoverCoreOperations();
    const corePaths = buildPathsFromCore(coreOperations);
    const modulePaths = buildPathsFromModules(modules);

    // Merge - core paths win in the event of a collision (should not happen
    // because core uses /auth, /users, etc. and modules use their own prefixes).
    const paths: Record<string, PathItem> = { ...modulePaths, ...corePaths };

    const moduleTags = modules
        .filter((m) => m.api && m.api.length > 0)
        .map((m) => ({
            name: m.id,
            description: `${m.name}${m.description ? ` - ${m.description}` : ""}`,
        }));

    const spec = {
        openapi: "3.0.3",
        info: {
            title: "uxwVend API",
            description:
                "The API surface uxwVend exports, discovered from the code: core operations from the verbs each route file exports, module operations from the verbs each declared handler exports. Nothing here is documented that is not implemented.",
            version: "1.0.0",
            contact: {
                name: "uxwVend",
                url: "https://github.com/UXPLIMA/uxw-vend",
            },
        },
        servers: [{ url: "/", description: "Current server" }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                apiKeyAuth: {
                    type: "apiKey",
                    in: "header",
                    name: "x-api-key",
                },
            },
        },
        paths,
        tags: [
            { name: "Auth", description: "Authentication and session" },
            { name: "Users", description: "User administration" },
            { name: "Roles", description: "Roles and permissions" },
            { name: "Modules", description: "Module management" },
            { name: "Settings", description: "Platform settings" },
            { name: "Media", description: "Uploads and media library" },
            { name: "Search", description: "Site-wide search" },
            { name: "API Keys", description: "API key management" },
            { name: "System", description: "Health, metrics, backups" },
            { name: "Stats", description: "Dashboard statistics" },
            { name: "Admin", description: "Administration endpoints" },
            { name: "Core", description: "Everything else core exports" },
            ...moduleTags,
        ],
    };

    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(spec, null, 2));
    const pathCount = Object.keys(paths).length;
    const opCount = Object.values(paths).reduce((n, item) => n + Object.keys(item).length, 0);
    console.log(
        `[openapi] Wrote ${OUTPUT_FILE} - ${pathCount} paths, ${opCount} operations ` +
            `(${coreOperations.length} from core routes, ${modules.length} modules scanned)`,
    );
}

generate();
