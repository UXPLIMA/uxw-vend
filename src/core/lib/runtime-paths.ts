/**
 * Runtime-resolved filesystem paths for module install/update/uninstall.
 *
 * Why a dedicated helper: Turbopack's NFT tracer follows `path.join(process.cwd(), …)`
 * calls up the import graph and, because they're unbounded, ends up tracing
 * the entire project into whichever serverless bundle references them.
 * Centralising the call here — with a single `/* turbopackIgnore: true *\/`
 * hint — keeps the bundle trace surgical while still letting admin routes
 * operate on the real working-directory tree at runtime.
 */

import path from "path";

const CWD = /* turbopackIgnore: true */ process.cwd();

export const MODULES_DIR = path.join(CWD, "src/modules");
export const TMP_DIR = path.join(CWD, "tmp");
export const BACKUPS_DIR = path.join(CWD, "backups");
export const PROJECT_ROOT = CWD;
