import { LoadedModule, ModuleManifest } from "./module-types";
import { moduleManifestSchema } from "./module-manifest-schema";

class ModuleLoader {
    private modules: Map<string, LoadedModule> = new Map();
    private initialized = false;

    public scanModules(): Map<string, LoadedModule> {
        // Only run on server (fs not available in browser/SSR client)
        if (typeof window !== "undefined") return this.modules;

        try {
            // Dynamic require to prevent bundler from pulling fs into client
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fs = require("fs");
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require("path");
            const modulesDir = path.join(process.cwd(), "src/modules");

            if (!fs.existsSync(modulesDir)) {
                return this.modules;
            }

            const entries = fs.readdirSync(modulesDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    this.loadModule(entry.name, modulesDir, fs, path);
                }
            }

            this.initialized = true;
            console.log(`Loaded ${this.modules.size} modules`);
        } catch {
            // fs not available (client-side) — return empty
        }

        return this.modules;
    }

    private loadModule(dirName: string, modulesDir: string, fs: typeof import("fs"), path: typeof import("path")) {
        try {
            const modulePath = path.join(modulesDir, dirName);
            const manifestPath = path.join(modulePath, "module.json");

            if (!fs.existsSync(manifestPath)) return;

            const manifestContent = fs.readFileSync(manifestPath, "utf-8");
            let parsedJson: unknown;
            try {
                parsedJson = JSON.parse(manifestContent);
            } catch (err) {
                console.warn(`[module-loader] ${dirName}: invalid JSON in module.json — skipping`, err);
                return;
            }

            const result = moduleManifestSchema.safeParse(parsedJson);
            if (!result.success) {
                const first = result.error.issues[0];
                const where = first.path.join(".");
                console.warn(
                    `[module-loader] ${dirName}: manifest schema invalid${where ? ` at ${where}` : ""} — ${first.message} — skipping`,
                );
                return;
            }

            this.modules.set(result.data.id, {
                manifest: result.data as unknown as ModuleManifest,
                path: modulePath,
            });
        } catch (error) {
            console.error(`Failed to load module ${dirName}:`, error);
        }
    }

    public getModules(): LoadedModule[] {
        if (!this.initialized) this.scanModules();
        return Array.from(this.modules.values());
    }

    public getModule(id: string): LoadedModule | undefined {
        if (!this.initialized) this.scanModules();
        return this.modules.get(id);
    }
}

export const moduleLoader = new ModuleLoader();
