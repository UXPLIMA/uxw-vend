// Runs after `npm install` to regenerate the gitignored artifacts
// (merged Prisma schema, module/theme registries, cleaned translations).
//
// The merged schema + registry files are never committed to git because they
// are a function of schema.core.prisma + whatever modules are installed in
// src/modules/. On a fresh clone those artifacts are missing — this script
// ensures the repo is usable immediately after `npm install`.
//
// Set SKIP_POSTINSTALL=1 (or CI=1 for images that run `npm run build` anyway)
// to bypass — e.g. Docker layer caching or CI environments that call the
// individual scripts explicitly.

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

if (process.env.SKIP_POSTINSTALL === "1") {
    process.exit(0);
}

const ROOT = process.cwd();

// Bail gracefully if we're running inside a nested npm install (e.g. inside
// node_modules of another package). Without this, lifecycle recursion can
// trigger regeneration in the wrong directory.
if (!fs.existsSync(path.join(ROOT, "prisma", "schema.core.prisma"))) {
    process.exit(0);
}

function run(label: string, cmd: string, args: string[]): void {
    const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
    if (result.status !== 0) {
        console.warn(`[postinstall] ${label} failed (exit ${result.status}). Run manually: ${cmd} ${args.join(" ")}`);
    }
}

run("merge-schemas", "npx", ["tsx", "scripts/merge-schemas.ts"]);
run("generate-themes", "npx", ["tsx", "scripts/generate-theme-registry.ts"]);
run("generate-registry", "npx", ["tsx", "scripts/generate-registry.ts"]);
