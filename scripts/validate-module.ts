import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { moduleManifestSchema } from "../src/core/lib/module-manifest-schema";
import { checkManifestFileRefs } from "../src/core/lib/module-ref-resolver";

const ROOT = process.cwd();

interface CheckResult {
    name: string;
    passed: boolean;
    message: string;
    suggestion?: string;
}

function usage(): never {
    console.error("Usage: npx tsx scripts/validate-module.ts <module-path>");
    console.error("       npx tsx scripts/validate-module.ts --all   (every module in module-sources/)");
    console.error("");
    console.error("  module-path   Path to the module directory (e.g., module-sources/my-module)");
    console.error("");
    console.error("Example:");
    console.error("  npx tsx scripts/validate-module.ts module-sources/store");
    process.exit(1);
}

function checkManifestExists(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");

    if (!fs.existsSync(manifestPath)) {
        return {
            name: "module.json exists",
            passed: false,
            message: "module.json not found",
            suggestion: "Create a module.json file. See module-template/module.json for reference.",
        };
    }

    try {
        JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        return { name: "module.json exists", passed: true, message: "Valid JSON" };
    } catch (err) {
        return {
            name: "module.json exists",
            passed: false,
            message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            suggestion: "Fix the JSON syntax in module.json.",
        };
    }
}

function checkRequiredFields(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) {
        return { name: "Required fields", passed: false, message: "No module.json to check" };
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const required = ["id", "name", "version"];
        const missing = required.filter((f) => !manifest[f]);

        if (missing.length > 0) {
            return {
                name: "Required fields",
                passed: false,
                message: `Missing: ${missing.join(", ")}`,
                suggestion: `Add the missing fields to module.json: ${missing.join(", ")}`,
            };
        }

        return { name: "Required fields", passed: true, message: "id, name, version present" };
    } catch {
        return { name: "Required fields", passed: false, message: "Cannot parse module.json" };
    }
}

function checkIdFormat(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) {
        return { name: "ID format", passed: false, message: "No module.json to check" };
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const id = manifest.id;

        if (!id) {
            return { name: "ID format", passed: false, message: "No id field" };
        }

        if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(id)) {
            return {
                name: "ID format",
                passed: false,
                message: `Invalid ID "${id}"`,
                suggestion: "ID must be lowercase alphanumeric + hyphens, start with a letter, end with alphanumeric.",
            };
        }

        if (id.includes("--")) {
            return {
                name: "ID format",
                passed: false,
                message: `ID "${id}" contains double hyphens`,
                suggestion: "Remove consecutive hyphens from the ID.",
            };
        }

        return { name: "ID format", passed: true, message: `"${id}" is valid` };
    } catch {
        return { name: "ID format", passed: false, message: "Cannot parse module.json" };
    }
}

function checkManifestSchema(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) {
        return { name: "Manifest schema", passed: false, message: "No module.json to check" };
    }

    try {
        const parsed = moduleManifestSchema.safeParse(
            JSON.parse(fs.readFileSync(manifestPath, "utf8")),
        );
        if (parsed.success) {
            return { name: "Manifest schema", passed: true, message: "Matches moduleManifestSchema" };
        }

        // This is the same schema the install, upload and update routes run a
        // manifest through before they touch the disk. Until it was wired in
        // here, a manifest CI called valid could still be refused on install -
        // a ref like `../../src/core/lib/db` passed every check in this script
        // while the routes rejected it outright.
        const issues = parsed.error.issues
            .slice(0, 10)
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
        return {
            name: "Manifest schema",
            passed: false,
            message: `${parsed.error.issues.length} problem(s):\n      ${issues.join("\n      ")}`,
            suggestion: "Fix module.json to match the manifest schema in src/core/lib/module-manifest-schema.ts.",
        };
    } catch (err) {
        return {
            name: "Manifest schema",
            passed: false,
            message: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

function checkReferencedFiles(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) {
        return { name: "Referenced files", passed: false, message: "No module.json to check" };
    }

    try {
        const parsed = moduleManifestSchema.safeParse(
            JSON.parse(fs.readFileSync(manifestPath, "utf8")),
        );
        if (!parsed.success) {
            // The manifest-shape check reports this properly; don't double-fail.
            return { name: "Referenced files", passed: true, message: "Skipped (manifest does not parse)" };
        }

        // Same resolver the install, upload and update routes use. This check
        // used to be a separate hand-rolled walk that covered only five of the
        // keys that can carry a ref and matched the others verbatim, so it
        // passed fourteen modules the install route then refused.
        const { escaping, missing } = checkManifestFileRefs(modulePath, parsed.data);
        const problems = [
            ...escaping.map((r) => `escapes module root: ${r}`),
            ...missing.map((r) => `not found: ${r}`),
        ];

        if (problems.length > 0) {
            return {
                name: "Referenced files",
                passed: false,
                message: `${problems.length} file(s) not found:\n      ${problems.join("\n      ")}`,
                suggestion: "Create the missing files or update the paths in module.json.",
            };
        }

        return { name: "Referenced files", passed: true, message: "All referenced files exist" };
    } catch (err) {
        return {
            name: "Referenced files",
            passed: false,
            message: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
function checkNoCoreImports(modulePath: string): CheckResult {
    // Check that module code doesn't import from other modules directly
    const moduleId = path.basename(modulePath);

    function walkFiles(dir: string): string[] {
        const results: string[] = [];
        if (!fs.existsSync(dir)) return results;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...walkFiles(fullPath));
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                results.push(fullPath);
            }
        }
        return results;
    }

    const files = walkFiles(modulePath);
    const violations: string[] = [];

    for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check for imports from other modules (not @/core/*, not relative)
            const importMatch = line.match(/from\s+["']@\/modules\/([^/"']+)/);
            if (importMatch && importMatch[1] !== moduleId) {
                const relPath = path.relative(modulePath, file);
                violations.push(`${relPath}:${i + 1} imports from @/modules/${importMatch[1]}`);
            }
        }
    }

    if (violations.length > 0) {
        return {
            name: "No cross-module imports",
            passed: false,
            message: `${violations.length} cross-module import(s):\n      ${violations.slice(0, 5).join("\n      ")}${violations.length > 5 ? `\n      ... and ${violations.length - 5} more` : ""}`,
            suggestion: "Modules should not import directly from other modules. Use core utilities or events instead.",
        };
    }

    return { name: "No cross-module imports", passed: true, message: "No cross-module imports found" };
}

/**
 * Modules must import core through the published SDK (`@/core/sdk*`), never
 * through core's internal layout (`@/core/lib/*`, `@/core/components/*`).
 *
 * This is the gate that actually holds the boundary: ESLint globally ignores
 * `module-sources/**` and `src/modules/**`, and the main tsconfig excludes
 * module sources, so neither would catch a violation. This check runs in
 * `build-marketplace.sh` and in CI, and covers third-party ZIPs at authoring
 * time.
 */
function checkSdkImports(modulePath: string): CheckResult {
    function walkFiles(dir: string): string[] {
        const results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...walkFiles(fullPath));
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                results.push(fullPath);
            }
        }
        return results;
    }

    const violations: string[] = [];
    // Catches both `from "@/core/lib/x"` and `await import("@/core/lib/x")`.
    const deepImport = /["']@\/core\/(lib|components)\/[^"']*["']/;

    for (const file of walkFiles(modulePath)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (deepImport.test(lines[i])) {
                violations.push(`${path.relative(modulePath, file)}:${i + 1}`);
            }
        }
    }

    if (violations.length > 0) {
        return {
            name: "SDK imports only",
            passed: false,
            message: `${violations.length} import(s) reach into core internals:\n      ${violations.slice(0, 5).join("\n      ")}${violations.length > 5 ? `\n      ... and ${violations.length - 5} more` : ""}`,
            suggestion: "Import from @/core/sdk (isomorphic), or one of @/core/sdk/{server,auth,navigation,blocks,theme,ui,layout,admin}. Run `npx tsx scripts/migrate-module-imports.ts <path>` to rewrite them.",
        };
    }

    return { name: "SDK imports only", passed: true, message: "No @/core/lib or @/core/components imports" };
}

function checkSchemaPrisma(modulePath: string): CheckResult {
    const schemaPath = path.join(modulePath, "schema.prisma");

    if (!fs.existsSync(schemaPath)) {
        return { name: "schema.prisma", passed: true, message: "No schema.prisma (optional)" };
    }

    const content = fs.readFileSync(schemaPath, "utf8");

    const hasUserRelations = content.includes("@@user-relations-start");

    // Check for basic model definitions. A schema whose only job is to add
    // fields to the core User model (two-factor-auth) legitimately declares
    // no models of its own.
    const modelCount = (content.match(/^model\s+\w+/gm) || []).length;
    if (modelCount === 0 && !hasUserRelations) {
        return {
            name: "schema.prisma",
            passed: false,
            message: "No model definitions found",
            suggestion: "Add at least one Prisma model or a @@user-relations-start/end block, or remove schema.prisma if not needed.",
        };
    }

    // A field typed `User` needs the reverse field on the core User model,
    // and merge-schemas only emits those from the relations block - without
    // it the merged schema does not validate. A bare `userId String` column
    // with no `@relation` is a deliberate loose reference (anonymous form
    // submissions, records that outlive their author) and needs nothing.
    const relatesToUser = /^\s*\w+\s+User(\[\]|\?)?(\s|$)/m.test(content);

    if (relatesToUser && !hasUserRelations) {
        return {
            name: "schema.prisma",
            passed: false,
            message: "Models declare a User relation but no @@user-relations-start/end block",
            suggestion: "Add a @@user-relations-start/end comment block declaring the reverse field on User.",
        };
    }

    // Check for @id @default(cuid()) on models
    const models = content.match(/model\s+\w+\s*\{[^}]+\}/g) || [];
    const missingId: string[] = [];
    for (const model of models) {
        const modelName = model.match(/model\s+(\w+)/)?.[1];
        if (modelName && !model.includes("@id")) {
            missingId.push(modelName);
        }
    }

    if (missingId.length > 0) {
        return {
            name: "schema.prisma",
            passed: false,
            message: `Models missing @id: ${missingId.join(", ")}`,
            suggestion: "Every model should have an @id field.",
        };
    }

    return {
        name: "schema.prisma",
        passed: true,
        message: `Valid (${modelCount} model${modelCount !== 1 ? "s" : ""})`,
    };
}

/**
 * One `typecheck:modules` run, shared by every module this process validates.
 *
 * That script is the only thing that can type-check module code: it builds a
 * throwaway Prisma client from every module schema and compiles against
 * `tsconfig.modules.json`. Running plain `tsc --project tsconfig.json` here
 * instead, as this check used to, could not work - the main tsconfig excludes
 * `module-sources/` entirely, so the program contained none of the files being
 * validated and the check reported a pass no matter what was in them. It let a
 * bad SDK import through that the real gate caught minutes later.
 */
let modulesTypecheck: { output: string } | null = null;

function runModulesTypecheck(): string {
    if (!modulesTypecheck) {
        const result = spawnSync("npx", ["tsx", "scripts/typecheck-modules.ts"], {
            cwd: ROOT,
            encoding: "utf8",
            timeout: 600000,
        });
        modulesTypecheck = { output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
    }
    return modulesTypecheck.output;
}

function checkTypeScript(modulePath: string): CheckResult {
    const tsFiles: string[] = [];

    function walkFiles(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkFiles(fullPath);
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                tsFiles.push(fullPath);
            }
        }
    }

    walkFiles(modulePath);

    if (tsFiles.length === 0) {
        return { name: "TypeScript compilation", passed: true, message: "No TypeScript files" };
    }

    // The typecheck compiles `module-sources/`, so a module kept anywhere else
    // cannot be reached from here. Saying so is the honest answer; claiming a
    // pass is what the old version did.
    const relModulePath = path.relative(ROOT, modulePath).split(path.sep).join("/");
    if (!relModulePath.startsWith("module-sources/")) {
        return {
            name: "TypeScript compilation",
            passed: true,
            message: "Skipped - only modules under module-sources/ can be type-checked",
        };
    }

    try {
        const output = runModulesTypecheck();
        const errorLines = output
            .split("\n")
            .filter((line: string) => line.includes("error TS") && line.includes(`${relModulePath}/`));

        if (errorLines.length > 0) {
            const shown = errorLines.slice(0, 5);
            return {
                name: "TypeScript compilation",
                passed: false,
                message: `TypeScript errors:\n      ${shown.join("\n      ")}${errorLines.length > 5 ? "\n      ..." : ""}`,
                suggestion: "Fix the TypeScript errors shown above.",
            };
        }

        return { name: "TypeScript compilation", passed: true, message: `${tsFiles.length} file(s) pass` };
    } catch (err) {
        return {
            name: "TypeScript compilation",
            passed: false,
            message: `Could not run the module typecheck: ${err instanceof Error ? err.message : String(err)}`,
            suggestion: "Run `npm run typecheck:modules` directly to see what went wrong.",
        };
    }
}

function checkNoAnyTypes(modulePath: string): CheckResult {
    function walkFiles(dir: string): string[] {
        const results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...walkFiles(fullPath));
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                results.push(fullPath);
            }
        }
        return results;
    }

    const files = walkFiles(modulePath);
    const violations: string[] = [];

    for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip comments
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

            // Match explicit `any` type annotations, but not words containing "any" (e.g., "many", "company")
            // Patterns: `: any`, `<any>`, `as any`, `: any[]`, `any>`, `any,`, `any)`
            if (/(?::\s*any\b|<any\b|as\s+any\b|\bany\s*[>\],)])/.test(line)) {
                const relPath = path.relative(modulePath, file);
                violations.push(`${relPath}:${i + 1}`);
            }
        }
    }

    if (violations.length > 0) {
        return {
            name: "No 'any' types",
            passed: false,
            message: `${violations.length} 'any' type(s) found:\n      ${violations.slice(0, 5).join("\n      ")}${violations.length > 5 ? `\n      ... and ${violations.length - 5} more` : ""}`,
            suggestion: "Replace 'any' with proper types. Use Record<string, unknown> for generic objects.",
        };
    }

    return { name: "No 'any' types", passed: true, message: "No 'any' types found" };
}

/** `@provider-callback:` followed by an actual reason, not just the marker. */
const PROVIDER_CALLBACK = /@provider-callback:[ \t]*\S+/;

function checkApiAuthChecks(modulePath: string): CheckResult {
    function walkFiles(dir: string): string[] {
        const results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...walkFiles(fullPath));
            } else if (entry.name.endsWith(".ts")) {
                results.push(fullPath);
            }
        }
        return results;
    }

    const apiDir = path.join(modulePath, "api");
    if (!fs.existsSync(apiDir)) {
        return { name: "API auth checks", passed: true, message: "No API directory" };
    }

    const files = walkFiles(apiDir);
    const violations: string[] = [];

    for (const file of files) {
        const content = fs.readFileSync(file, "utf8");

        // Check if file has POST, PUT, DELETE, PATCH exports
        const writeMethods = ["POST", "PUT", "DELETE", "PATCH"];
        const hasWriteMethod = writeMethods.some((method) =>
            new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(content)
        );

        if (hasWriteMethod) {
            // Check for auth/session checks
            const hasAuthCheck =
                content.includes("auth()") ||
                content.includes("isAdmin(") ||
                content.includes("isStaff(") ||
                content.includes("hasPermission(") ||
                content.includes("session?.user") ||
                // Provider webhooks have no session by construction: the caller
                // is Stripe/PayPal/Discord, not a browser. They authenticate by
                // verifying a signature over the raw body, which is stronger
                // than a session check for that endpoint. Both markers below
                // are signature verification and cannot appear by accident.
                content.includes("webhooks.constructEvent(") ||
                content.includes("timingSafeEqual(") ||
                // Not every provider signs its callbacks. Several answer the
                // question the other way round: the callback carries nothing
                // but an opaque id, and the route asks the provider's API,
                // with the site's own credentials, what that id is worth. That
                // is authentication too, and it leaves no marker in the source
                // this check could recognise - so the route says so itself,
                // with a reason:
                //
                //     // @provider-callback: Mollie posts only a payment id;
                //     // the status is read back from Mollie with our API key.
                //
                // The reason is required. A bare marker is not a bypass.
                PROVIDER_CALLBACK.test(content);

            if (!hasAuthCheck) {
                const relPath = path.relative(modulePath, file);
                violations.push(relPath);
            }
        }
    }

    if (violations.length > 0) {
        return {
            name: "API auth checks",
            passed: false,
            message: `${violations.length} write endpoint(s) without auth:\n      ${violations.join("\n      ")}`,
            suggestion:
                "Add auth checks (auth(), isAdmin(), etc.) to POST/PUT/DELETE/PATCH handlers. " +
                "A provider callback that verifies by calling the provider back marks itself " +
                "'@provider-callback: <why>' instead.",
        };
    }

    return { name: "API auth checks", passed: true, message: "All write endpoints have auth checks" };
}

/**
 * A hook name is a contract with modules that will never import this one, and
 * nothing fails at runtime when the two halves disagree: a listener on a
 * misspelled hook simply never fires. `hooksEmitted` makes this module's half
 * declarative so it can be checked - here against the module's own source, and
 * in build-marketplace.sh against every listener in the catalog.
 *
 * Only string literals are matched. A dynamically named hook
 * (`doAction(`${resource}.created`, …)`, as core's crud helpers do) cannot be
 * declared and is not required to be.
 */
function checkHooksEmitted(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) {
        return { name: "hooksEmitted", passed: true, message: "No manifest" };
    }

    let manifest: { hooksEmitted?: { hook: string; type: string }[] };
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
        return { name: "hooksEmitted", passed: true, message: "Manifest unparseable (reported above)" };
    }

    function walkFiles(dir: string): string[] {
        const results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) results.push(...walkFiles(full));
            else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) results.push(full);
        }
        return results;
    }

    const emitCall = /\b(doAction|doActionAsync|applyFilters|applyFiltersAsync)\(\s*"([^"]+)"/g;
    const found = new Map<string, "action" | "filter">();
    for (const file of walkFiles(modulePath)) {
        const content = fs.readFileSync(file, "utf8");
        for (const m of content.matchAll(emitCall)) {
            found.set(m[2], m[1].includes("Filter") ? "filter" : "action");
        }
    }

    const declared = new Map((manifest.hooksEmitted ?? []).map((h) => [h.hook, h.type]));

    const undeclared = [...found].filter(([hook]) => !declared.has(hook)).map(([hook]) => hook);
    const unused = [...declared.keys()].filter((hook) => !found.has(hook));
    const wrongType = [...found]
        .filter(([hook, type]) => declared.has(hook) && declared.get(hook) !== type)
        .map(([hook, type]) => `${hook} (fired as ${type}, declared as ${declared.get(hook)})`);

    const problems = [
        ...undeclared.map((h) => `fired but not declared: ${h}`),
        ...unused.map((h) => `declared but never fired: ${h}`),
        ...wrongType.map((h) => `type mismatch: ${h}`),
    ];

    if (problems.length > 0) {
        return {
            name: "hooksEmitted",
            passed: false,
            message: `${problems.length} hook declaration problem(s):\n      ${problems.slice(0, 8).join("\n      ")}${problems.length > 8 ? `\n      ... and ${problems.length - 8} more` : ""}`,
            suggestion: 'Every doAction/applyFilters call with a literal name needs a matching { "hook", "type" } entry in the manifest\'s hooksEmitted array, and vice versa.',
        };
    }

    return {
        name: "hooksEmitted",
        passed: true,
        message: found.size === 0 ? "Fires no hooks" : `${found.size} hook(s) fired and declared`,
    };
}

/**
 * Every API handler on disk must be registered, and every admin CRUD screen
 * must be able to reach the endpoints it calls.
 *
 * A `route.ts` under `api/` does nothing on its own: requests arrive through
 * `/api/v1/[...path]`, which only knows the routes the manifest declares. Four
 * modules shipped an `[id]` handler that was never declared, so editing or
 * deleting from their admin screens answered 404, and the vote module pointed
 * its screen at `/api/v1/vote` while declaring `/api/v1/vote/sites`, so
 * creating one did too. Nothing failed at build time and nothing failed in
 * the tests: the screen and the handler were each fine on their own.
 *
 * `AdminCrudPage` lists and creates at `apiPath` and edits and deletes at
 * `apiPath/{id}`, so both have to exist.
 */
/**
 * A module's `statsApi` feeds the admin dashboard and the analytics screen -
 * order counts, revenue, the latest support tickets with the usernames on
 * them. It is admin data by definition, and the route serving it is a plain
 * GET, which `checkApiAuthChecks` above does not look at: that check only
 * asks about writes. Four first-party modules shipped this endpoint open, so
 * anyone could read a shop's daily revenue without logging in.
 */
function checkStatsApiAuth(modulePath: string): CheckResult {
    const name = "Stats API is admin only";
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) return { name, passed: true, message: "No manifest" };

    let manifest: { statsApi?: string; api?: { path: string; handler: string }[] };
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
        return { name, passed: true, message: "Manifest unparseable (reported above)" };
    }

    const statsPath = manifest.statsApi;
    if (!statsPath) return { name, passed: true, message: "No stats API declared" };

    const entry = (manifest.api ?? []).find((a) => a.path === statsPath);
    if (!entry) {
        return {
            name,
            passed: false,
            message: `statsApi "${statsPath}" is not one of the module's declared api routes`,
        };
    }

    const handlerPath = path.join(modulePath, entry.handler);
    if (!fs.existsSync(handlerPath)) {
        return { name, passed: false, message: `statsApi handler is missing: ${entry.handler}` };
    }

    const content = fs.readFileSync(handlerPath, "utf8");
    const guarded =
        content.includes("isAdmin(") ||
        content.includes("isStaff(") ||
        content.includes("hasPermission(");
    if (!guarded) {
        return {
            name,
            passed: false,
            message:
                `${entry.handler} serves the admin dashboard but checks nobody - ` +
                `an anonymous GET reads it. Call isAdmin() (or hasPermission()) before answering.`,
        };
    }

    return { name, passed: true, message: `${entry.handler} checks for an admin` };
}

function checkApiRoutesWired(modulePath: string): CheckResult {
    const name = "API routes wired";
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) return { name, passed: true, message: "No manifest" };

    let manifest: { api?: { path: string; handler: string }[] };
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
        return { name, passed: true, message: "Manifest unparseable (reported above)" };
    }

    const api = manifest.api ?? [];
    const declaredHandlers = new Set(api.map((a) => a.handler.replace(/\\/g, "/")));
    const declaredPaths = api.map((a) => `/api/v1${a.path}`);
    const problems: string[] = [];

    // 1. Handlers on disk that nothing routes to.
    const apiDir = path.join(modulePath, "api");
    const onDisk: string[] = [];
    (function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name === "route.ts") onDisk.push(path.relative(modulePath, full).replace(/\\/g, "/"));
        }
    })(apiDir);
    for (const handler of onDisk) {
        if (!declaredHandlers.has(handler)) problems.push(`handler never registered: ${handler}`);
    }

    // 2. Admin CRUD screens whose endpoints are not declared.
    const screens: string[] = [];
    (function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith(".tsx")) screens.push(full);
        }
    })(path.join(modulePath, "pages"));

    for (const file of screens) {
        const content = fs.readFileSync(file, "utf8");
        if (!content.includes("AdminCrudPage")) continue;
        const match = /apiPath=["']([^"']+)["']/.exec(content);
        if (!match) continue;
        const apiPath = match[1];
        const where = path.relative(modulePath, file).replace(/\\/g, "/");
        if (!declaredPaths.includes(apiPath)) {
            problems.push(`${where}: apiPath ${apiPath} is not a declared route`);
        }
        const hasItemRoute = declaredPaths.some((d) => {
            if (!d.startsWith(`${apiPath}/`)) return false;
            return /^\[[^\]]+\]$/.test(d.slice(apiPath.length + 1));
        });
        if (!hasItemRoute) {
            problems.push(`${where}: no declared route for ${apiPath}/[id] - edit and delete would 404`);
        }
    }

    if (problems.length > 0) {
        return {
            name,
            passed: false,
            message: `${problems.length} routing problem(s):\n      ${problems.slice(0, 8).join("\n      ")}${problems.length > 8 ? `\n      ... and ${problems.length - 8} more` : ""}`,
            suggestion: 'Every api/**/route.ts needs an { "path", "handler" } entry in the manifest, and an AdminCrudPage needs both its collection route and its [id] route declared.',
        };
    }

    return {
        name,
        passed: true,
        message: onDisk.length === 0 ? "Ships no API routes" : `${onDisk.length} handler(s) registered`,
    };
}

/**
 * Run every check against one module. Returns the failures, if any.
 *
 * `withTypeScript` exists because `checkTypeScript` shells out to a full
 * `tsc --noEmit` over the whole project and then filters the output down to
 * this module's files. That is tolerable for one module - a third-party author
 * running the command once - but `--all` would pay it 42 times over. In that
 * mode `npm run typecheck:modules` is the check that actually covers the tree,
 * and it does so against a Prisma client that has the module models in it,
 * which this one does not.
 */
function validateOne(modulePath: string, verbose: boolean, withTypeScript = true): CheckResult[] {
    const moduleName = path.basename(modulePath);

    if (verbose) {
        console.log(`\nValidating module: ${moduleName}`);
        console.log(`Path: ${modulePath}`);
        console.log("─".repeat(60));
    }

    const checks: CheckResult[] = [
        checkManifestExists(modulePath),
        checkRequiredFields(modulePath),
        checkIdFormat(modulePath),
        checkManifestSchema(modulePath),
        checkReferencedFiles(modulePath),
        checkNoCoreImports(modulePath),
        checkSdkImports(modulePath),
        checkSchemaPrisma(modulePath),
        ...(withTypeScript
            ? [checkTypeScript(modulePath)]
            : [
                  {
                      name: "TypeScript compilation",
                      passed: true,
                      message: "Skipped - covered by `npm run typecheck:modules`",
                  },
              ]),
        checkNoAnyTypes(modulePath),
        checkApiAuthChecks(modulePath),
        checkApiRoutesWired(modulePath),
        checkStatsApiAuth(modulePath),
        checkHooksEmitted(modulePath),
    ];

    if (verbose) {
        for (const check of checks) {
            console.log(`\n  [${check.passed ? "PASS" : "FAIL"}] ${check.name}`);
            console.log(`      ${check.message}`);
            if (!check.passed && check.suggestion) {
                console.log(`      Suggestion: ${check.suggestion}`);
            }
        }

        const failed = checks.filter((c) => !c.passed).length;
        console.log("\n" + "─".repeat(60));
        console.log(`Results: ${checks.length - failed} passed, ${failed} failed out of ${checks.length} checks`);
        console.log(failed > 0 ? "\nFix the issues above and run validation again." : "\nAll checks passed!");
    }

    return checks.filter((c) => !c.passed);
}

function main(): void {
    const args = process.argv.slice(2);

    // `--all` walks module-sources/ in one process. Spawning tsx per module
    // costs ~3s of startup each, which is why CI needs this rather than a
    // shell loop.
    if (args[0] === "--all") {
        const sources = path.join(ROOT, "module-sources");
        const modules = fs
            .readdirSync(sources, { withFileTypes: true })
            .filter((e) => e.isDirectory() && fs.existsSync(path.join(sources, e.name, "module.json")))
            .map((e) => e.name)
            .sort();

        const broken = new Map<string, CheckResult[]>();
        for (const name of modules) {
            const failures = validateOne(path.join(sources, name), false, false);
            if (failures.length > 0) broken.set(name, failures);
            console.log(`  [${failures.length === 0 ? "PASS" : "FAIL"}] ${name}`);
        }

        if (broken.size > 0) {
            console.error(`\n${broken.size} of ${modules.length} module(s) failed validation:\n`);
            for (const [name, failures] of broken) {
                console.error(`  ${name}`);
                for (const f of failures) {
                    console.error(`    - ${f.name}: ${f.message.split("\n")[0]}`);
                    if (f.suggestion) console.error(`      ${f.suggestion}`);
                }
            }
            process.exit(1);
        }

        console.log(`\n${modules.length} module(s) validated, 0 failures.`);
        return;
    }

    if (args.length === 0) {
        usage();
    }

    const modulePath = path.resolve(ROOT, args[0]);

    if (!fs.existsSync(modulePath)) {
        console.error(`Error: Module path not found: ${modulePath}`);
        process.exit(1);
    }

    if (!fs.statSync(modulePath).isDirectory()) {
        console.error(`Error: Not a directory: ${modulePath}`);
        process.exit(1);
    }

    if (validateOne(modulePath, true).length > 0) process.exit(1);
}

main();
