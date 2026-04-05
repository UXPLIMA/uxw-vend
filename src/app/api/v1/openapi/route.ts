import { NextResponse } from "next/server";
import { ModuleApiRoutes } from "@/core/generated/module-data";

// GET /api/v1/openapi - OpenAPI spec (auto-generated from module registry)
export async function GET() {
    // Core API paths (always available)
    const corePaths: Record<string, Record<string, unknown>> = {
        "/auth/profile": {
            get: { summary: "Get profile", tags: ["Auth"], security: [{ session: [] }] },
            patch: { summary: "Update profile", tags: ["Auth"], security: [{ session: [] }] },
        },
        "/auth/login": { post: { summary: "Login", tags: ["Auth"] } },
        "/auth/register": { post: { summary: "Register", tags: ["Auth"] } },
        "/modules": { get: { summary: "List modules", tags: ["System"] } },
        "/modules/status": { get: { summary: "Module status", tags: ["System"] } },
        "/settings": { get: { summary: "Get settings (admin)", tags: ["System"], security: [{ session: [] }] } },
        "/public-settings": { get: { summary: "Get public settings", tags: ["System"] } },
        "/users": { get: { summary: "List users (admin)", tags: ["System"], security: [{ session: [] }] } },
        "/notifications": { get: { summary: "Get notifications", tags: ["System"], security: [{ session: [] }] } },
    };

    // Auto-generate paths from module API registry
    const modulePaths: Record<string, Record<string, unknown>> = {};
    for (const route of ModuleApiRoutes) {
        const path = `/${route.path}`;
        if (!modulePaths[path]) modulePaths[path] = {};
        const method = (route.method || "GET").toLowerCase();
        modulePaths[path][method] = {
            summary: `${route.module}: ${route.path}`,
            tags: [route.module],
        };
    }

    const spec = {
        openapi: "3.0.0",
        info: {
            title: "uxwVend API",
            version: "1.0.0",
            description: "Modular platform API — paths auto-generated from installed modules",
        },
        servers: [{ url: "/api/v1", description: "API v1" }],
        paths: { ...corePaths, ...modulePaths },
        components: {
            securitySchemes: {
                session: { type: "apiKey", in: "cookie", name: "next-auth.session-token" },
            },
        },
    };

    return NextResponse.json(spec);
}
