/**
 * Generate OpenAPI 3.0 spec from module manifests + core endpoints.
 *
 * Reads all modules from src/modules, walks each module.json's `api` array,
 * combines with a hardcoded list of core endpoints, and writes a single
 * static JSON file at src/core/generated/openapi.json.
 *
 * Runs as part of `prebuild`. Can also be invoked manually:
 *   npx tsx scripts/generate-openapi.ts
 */

import fs from "fs";
import path from "path";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
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
    tags: string[];
    secured?: boolean;
    parameters?: OpenApiOperation["parameters"];
    requestBody?: OpenApiOperation["requestBody"];
    responses?: OpenApiOperation["responses"];
}

// Hand-written core endpoints. Keep this list focused on the most
// important entry points — authoritative surface of the core API.
const CORE_ENDPOINTS: CoreEndpoint[] = [
    // --- Auth ---
    {
        path: "/api/v1/auth/login",
        method: "post",
        summary: "Log in with credentials",
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
        tags: ["Auth"],
        responses: { "200": { description: "Reset email sent" } },
    },
    {
        path: "/api/v1/auth/reset-password",
        method: "post",
        summary: "Reset password with token",
        tags: ["Auth"],
        responses: { "200": { description: "Password reset" } },
    },
    {
        path: "/api/v1/auth/profile",
        method: "get",
        summary: "Get current user profile",
        tags: ["Auth"],
        secured: true,
        responses: { "200": { description: "Profile data" } },
    },
    {
        path: "/api/v1/auth/profile",
        method: "patch",
        summary: "Update current user profile",
        tags: ["Auth"],
        secured: true,
        responses: { "200": { description: "Updated" } },
    },

    // --- Users ---
    {
        path: "/api/v1/users",
        method: "get",
        summary: "List users (admin)",
        tags: ["Users"],
        secured: true,
        responses: { "200": { description: "User list" } },
    },
    {
        path: "/api/v1/users/{id}",
        method: "get",
        summary: "Get user by id (admin)",
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
    {
        path: "/api/v1/users/{id}",
        method: "delete",
        summary: "Delete user (admin)",
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
        responses: { "204": { description: "Deleted" } },
    },

    // --- Roles ---
    {
        path: "/api/v1/roles",
        method: "get",
        summary: "List roles",
        tags: ["Roles"],
        secured: true,
        responses: { "200": { description: "Role list" } },
    },
    {
        path: "/api/v1/roles",
        method: "post",
        summary: "Create role (admin)",
        tags: ["Roles"],
        secured: true,
        responses: { "201": { description: "Role created" } },
    },

    // --- Modules ---
    {
        path: "/api/v1/modules",
        method: "get",
        summary: "List modules (admin)",
        tags: ["Modules"],
        secured: true,
        responses: { "200": { description: "Module list" } },
    },
    {
        path: "/api/v1/modules",
        method: "patch",
        summary: "Enable/disable module (admin)",
        tags: ["Modules"],
        secured: true,
        responses: { "200": { description: "Updated" } },
    },
    {
        path: "/api/v1/modules/marketplace/install",
        method: "post",
        summary: "Install module from marketplace (admin)",
        tags: ["Modules"],
        secured: true,
        responses: { "200": { description: "Installed" } },
    },

    // --- Settings ---
    {
        path: "/api/v1/settings",
        method: "get",
        summary: "Get settings (admin)",
        tags: ["Settings"],
        secured: true,
        responses: { "200": { description: "Settings" } },
    },
    {
        path: "/api/v1/settings",
        method: "patch",
        summary: "Update settings (admin)",
        tags: ["Settings"],
        secured: true,
        responses: { "200": { description: "Updated" } },
    },
    {
        path: "/api/v1/public-settings",
        method: "get",
        summary: "Get public settings",
        tags: ["Settings"],
        responses: { "200": { description: "Public settings" } },
    },

    // --- Media / uploads ---
    {
        path: "/api/v1/upload",
        method: "post",
        summary: "Upload file",
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
        tags: ["Media"],
        secured: true,
        responses: { "200": { description: "Media list" } },
    },

    // --- Search ---
    {
        path: "/api/v1/search",
        method: "get",
        summary: "Global search across enabled module search providers",
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
        tags: ["API Keys"],
        secured: true,
        responses: { "200": { description: "API key list" } },
    },
    {
        path: "/api/v1/api-keys",
        method: "post",
        summary: "Create API key (admin)",
        tags: ["API Keys"],
        secured: true,
        responses: { "201": { description: "Created" } },
    },

    // --- System ---
    {
        path: "/api/health",
        method: "get",
        summary: "Health check",
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
        tags: ["System"],
        secured: true,
        responses: { "200": { description: "Metrics" } },
    },
    {
        path: "/api/v1/admin/system",
        method: "get",
        summary: "System health info (admin)",
        tags: ["System"],
        secured: true,
        responses: { "200": { description: "System info" } },
    },
    {
        path: "/api/v1/admin/backup",
        method: "get",
        summary: "List backups (admin)",
        tags: ["System"],
        secured: true,
        responses: { "200": { description: "Backup list" } },
    },
    {
        path: "/api/v1/admin/backup",
        method: "post",
        summary: "Create backup (admin)",
        tags: ["System"],
        secured: true,
        responses: { "201": { description: "Backup created" } },
    },

    // --- Stats ---
    {
        path: "/api/v1/stats",
        method: "get",
        summary: "Dashboard statistics (admin)",
        tags: ["Stats"],
        secured: true,
        responses: { "200": { description: "Stats payload" } },
    },
];

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

function methodsForManifestEntry(
    method: ModuleApiEntry["method"],
): HttpMethod[] {
    if (!method || method === "ALL") {
        // A handler exporting multiple HTTP verbs is common in Next App Router.
        // For the OpenAPI surface, default to the most common verbs.
        return ["get", "post"];
    }
    return [method.toLowerCase() as HttpMethod];
}

function buildPathsFromModules(
    modules: ModuleManifestLite[],
): Record<string, PathItem> {
    const paths: Record<string, PathItem> = {};

    for (const mod of modules) {
        if (!mod.api) continue;
        for (const entry of mod.api) {
            const openApiPath = normalizePath(entry.path);
            const methods = methodsForManifestEntry(entry.method);

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
                        `${mod.name} — ${entry.path}`,
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

function buildPathsFromCore(): Record<string, PathItem> {
    const paths: Record<string, PathItem> = {};
    for (const ep of CORE_ENDPOINTS) {
        if (!paths[ep.path]) paths[ep.path] = {};
        const op: OpenApiOperation = {
            summary: ep.summary,
            tags: ep.tags,
            responses: ep.responses || {
                "200": { description: "Success" },
            },
        };
        if (ep.secured) op.security = [{ bearerAuth: [] }];
        if (ep.parameters) op.parameters = ep.parameters;
        if (ep.requestBody) op.requestBody = ep.requestBody;
        paths[ep.path][ep.method] = op;
    }
    return paths;
}

function generate() {
    const modules = loadModules();
    const corePaths = buildPathsFromCore();
    const modulePaths = buildPathsFromModules(modules);

    // Merge — core paths win in the event of a collision (should not happen
    // because core uses /auth, /users, etc. and modules use their own prefixes).
    const paths: Record<string, PathItem> = { ...modulePaths, ...corePaths };

    const moduleTags = modules
        .filter((m) => m.api && m.api.length > 0)
        .map((m) => ({
            name: m.id,
            description: `${m.name}${m.description ? ` — ${m.description}` : ""}`,
        }));

    const spec = {
        openapi: "3.0.3",
        info: {
            title: "uxwVend API",
            description:
                "Auto-generated API surface for uxwVend. Core endpoints are hand-curated; module endpoints are derived from each installed module's `module.json` manifest.",
            version: "1.0.0",
            contact: {
                name: "uxwVend",
                url: "https://github.com/siracozmen01/uxwVend",
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
            ...moduleTags,
        ],
    };

    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(spec, null, 2));
    const pathCount = Object.keys(paths).length;
    console.log(
        `[openapi] Wrote ${OUTPUT_FILE} — ${pathCount} paths (${modules.length} modules scanned)`,
    );
}

generate();
