import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

interface CheckResult {
    name: string;
    passed: boolean;
    message: string;
    suggestion?: string;
}

function usage(): never {
    console.error("Usage: npx tsx scripts/validate-module.ts <module-path>");
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

function checkReferencedFiles(modulePath: string): CheckResult {
    const manifestPath = path.join(modulePath, "module.json");
    if (!fs.existsSync(manifestPath)) {
        return { name: "Referenced files", passed: false, message: "No module.json to check" };
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const missing: string[] = [];

        // Check route components
        const routeArrays = [
            { key: "routes", field: "component" },
            { key: "adminRoutes", field: "component" },
        ];

        for (const { key, field } of routeArrays) {
            if (manifest[key]) {
                for (const route of manifest[key]) {
                    const filePath = path.join(modulePath, route[field]);
                    if (!fs.existsSync(filePath)) {
                        missing.push(`${key}: ${route[field]}`);
                    }
                }
            }
        }

        // Check API handlers
        if (manifest.api) {
            for (const api of manifest.api) {
                const filePath = path.join(modulePath, api.handler);
                if (!fs.existsSync(filePath)) {
                    missing.push(`api: ${api.handler}`);
                }
            }
        }

        // Check widget/component paths (these don't have extensions, try with .tsx)
        const componentArrays = [
            "widgets",
            "navbarComponents",
            "layoutComponents",
            "homepageSections",
            "profileTabs",
        ];

        for (const key of componentArrays) {
            if (manifest[key]) {
                for (const item of manifest[key]) {
                    const comp = item.component;
                    // Skip @core references
                    if (comp.startsWith("@core/")) continue;

                    const withExt = path.join(modulePath, comp + ".tsx");
                    const withoutExt = path.join(modulePath, comp);
                    const indexPath = path.join(modulePath, comp, "index.tsx");

                    if (!fs.existsSync(withExt) && !fs.existsSync(withoutExt) && !fs.existsSync(indexPath)) {
                        missing.push(`${key}: ${comp}`);
                    }
                }
            }
        }

        if (missing.length > 0) {
            return {
                name: "Referenced files",
                passed: false,
                message: `${missing.length} file(s) not found:\n      ${missing.join("\n      ")}`,
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

function checkSchemaPrisma(modulePath: string): CheckResult {
    const schemaPath = path.join(modulePath, "schema.prisma");

    if (!fs.existsSync(schemaPath)) {
        return { name: "schema.prisma", passed: true, message: "No schema.prisma (optional)" };
    }

    const content = fs.readFileSync(schemaPath, "utf8");

    // Check for basic model definitions
    const modelCount = (content.match(/^model\s+\w+/gm) || []).length;
    if (modelCount === 0) {
        return {
            name: "schema.prisma",
            passed: false,
            message: "No model definitions found",
            suggestion: "Add at least one Prisma model, or remove schema.prisma if not needed.",
        };
    }

    // Check for user-relations comment block
    const hasUserRelations = content.includes("@@user-relations-start");
    const modelsWithUserId = (content.match(/userId\s+String/g) || []).length;

    if (modelsWithUserId > 0 && !hasUserRelations) {
        return {
            name: "schema.prisma",
            passed: false,
            message: "Models reference userId but missing @@user-relations-start/end block",
            suggestion: "Add @@user-relations-start/end comment block to declare User model relations.",
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

function checkTypeScript(modulePath: string): CheckResult {
    // Run tsc --noEmit on the module files
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

    try {
        const tsconfigPath = path.join(ROOT, "tsconfig.json");
        if (!fs.existsSync(tsconfigPath)) {
            return { name: "TypeScript compilation", passed: true, message: "No tsconfig.json in project root (skipped)" };
        }

        // Use --project (can't mix with file args), but filter output to only our module files
        const output = execSync(`npx tsc --noEmit --project "${tsconfigPath}" 2>&1 || true`, {
            cwd: ROOT,
            timeout: 60000,
            encoding: "utf8",
        });

        // Filter errors to only those in our module path
        const relModulePath = path.relative(ROOT, modulePath);
        const errorLines = output
            .split("\n")
            .filter((line: string) => line.includes("error TS") && line.includes(relModulePath));

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
        const output = err instanceof Error && "stdout" in err ? String((err as NodeJS.ErrnoException & { stdout: string }).stdout) : String(err);
        const errorLines = output.split("\n").filter((l: string) => l.includes("error TS")).slice(0, 5);

        return {
            name: "TypeScript compilation",
            passed: false,
            message: `TypeScript errors:\n      ${errorLines.join("\n      ")}${errorLines.length >= 5 ? "\n      ..." : ""}`,
            suggestion: "Fix the TypeScript errors shown above.",
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
                content.includes("session?.user");

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
            suggestion: "Add auth checks (auth(), isAdmin(), etc.) to POST/PUT/DELETE/PATCH handlers.",
        };
    }

    return { name: "API auth checks", passed: true, message: "All write endpoints have auth checks" };
}

function main(): void {
    const args = process.argv.slice(2);

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

    const moduleName = path.basename(modulePath);
    console.log(`\nValidating module: ${moduleName}`);
    console.log(`Path: ${modulePath}`);
    console.log("─".repeat(60));

    const checks: CheckResult[] = [
        checkManifestExists(modulePath),
        checkRequiredFields(modulePath),
        checkIdFormat(modulePath),
        checkReferencedFiles(modulePath),
        checkNoCoreImports(modulePath),
        checkSchemaPrisma(modulePath),
        checkTypeScript(modulePath),
        checkNoAnyTypes(modulePath),
        checkApiAuthChecks(modulePath),
    ];

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
        const icon = check.passed ? "PASS" : "FAIL";
        console.log(`\n  [${icon}] ${check.name}`);
        console.log(`      ${check.message}`);

        if (!check.passed && check.suggestion) {
            console.log(`      Suggestion: ${check.suggestion}`);
        }

        if (check.passed) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log("\n" + "─".repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed out of ${checks.length} checks`);

    if (failed > 0) {
        console.log("\nFix the issues above and run validation again.");
        process.exit(1);
    } else {
        console.log("\nAll checks passed!");
    }
}

main();
