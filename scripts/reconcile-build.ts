/**
 * Boot-time build reconciliation. Runs in the app container before
 * `next start`, and is a no-op on the overwhelmingly common path.
 *
 * See src/core/lib/build-state.ts for why a Next build and the contents of
 * src/modules/ can fall out of sync. This script is the half that repairs it:
 * if the build on disk was not produced from the modules on disk, it rebuilds
 * before a single request is served.
 *
 * Failure policy: a failed rebuild is loud but not fatal as long as *some*
 * build exists. An admin who broke their install with a bad module still needs
 * the admin UI to reach the uninstall button; refusing to start would take
 * that away. Only a completely missing build stops the boot.
 */

import { execFileSync } from "child_process";
import {
    detectDrift,
    detectSchemaDrift,
    writeBuildState,
    writeSchemaState,
    readBuildState,
    readSchemaState,
    computeModuleFingerprint,
} from "../src/core/lib/build-state";

function log(msg: string): void {
    console.log(`[reconcile] ${msg}`);
}

/**
 * Regenerate the Prisma client when it does not know about the installed
 * modules. This is separate from the build check because the client lives in
 * node_modules — an image layer — so recreating a container silently reverts
 * it to the zero-module client while the build volume keeps every module. That
 * combination answers module queries with `undefined.findMany`.
 *
 * Cheap (seconds), so it runs before the build check rather than as part of it.
 */
function reconcileSchema(): void {
    const drift = detectSchemaDrift();
    if (!drift) return;

    log(`regenerating the Prisma client — ${drift.kind}: ${drift.detail}`);
    try {
        execFileSync("npx", ["tsx", "scripts/merge-schemas.ts"], {
            stdio: "inherit",
            cwd: process.cwd(),
        });
        writeSchemaState();
        log("Prisma client regenerated");
    } catch {
        console.error("[reconcile] Prisma client regeneration FAILED — module queries will not work.");
        console.error("[reconcile] Starting anyway so the admin UI stays reachable.");
    }
}

function main(): void {
    const started = Date.now();

    reconcileSchema();

    const drift = detectDrift();

    if (!drift) {
        const state = readBuildState();
        log(
            state
                ? `build matches installed modules (${state.moduleFingerprint.slice(0, 12)}) — starting`
                : "no modules installed and build is clean — starting",
        );
        // A first boot from a fresh image has a valid build and no state file.
        // Adopt it so the next boot compares against something.
        if (!state) writeBuildState();
        if (!readSchemaState()) writeSchemaState();
        return;
    }

    if (drift.kind === "no-build") {
        console.error(`[reconcile] FATAL: ${drift.detail}`);
        console.error("[reconcile] The image is missing its Next.js build. This is not repairable at boot.");
        process.exit(1);
    }

    log(`rebuild required — ${drift.kind}: ${drift.detail}`);
    log(`installed module fingerprint: ${computeModuleFingerprint().slice(0, 12)}`);
    log("running `npm run build` (this takes a few minutes; the container is not serving yet)");

    try {
        // `prebuild` re-runs merge-schemas, the theme registry, the module
        // registry and the OpenAPI document, so this one command covers every
        // generated artifact the build depends on.
        execFileSync("npm", ["run", "build"], { stdio: "inherit", cwd: process.cwd() });
    } catch {
        console.error("[reconcile] build FAILED. Starting the previous build so the admin UI stays reachable.");
        console.error("[reconcile] Modules installed since that build will not work until a build succeeds.");
        return;
    }

    // `prebuild` re-ran merge-schemas as part of the build, so both markers
    // are current now.
    writeBuildState();
    writeSchemaState();
    log(`rebuild finished in ${Math.round((Date.now() - started) / 1000)}s — starting`);
}

main();
