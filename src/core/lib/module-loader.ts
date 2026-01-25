
import fs from "fs";
import path from "path";
import { ModuleManifest, LoadedModule } from "./module-types";

// This will run on the server side only
const MODULES_DIR = path.join(process.cwd(), "src/modules");

class ModuleLoader {
    private modules: Map<string, LoadedModule> = new Map();
    private initialized = false;

    /**
     * Scan for modules in the modules directory
     */
    public scanModules(): Map<string, LoadedModule> {
        if (!fs.existsSync(MODULES_DIR)) {
            console.warn(`Modules directory not found at ${MODULES_DIR}`);
            return this.modules;
        }

        const entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                this.loadModule(entry.name);
            }
        }

        this.initialized = true;
        console.log(`Loaded ${this.modules.size} modules`);
        return this.modules;
    }

    /**
     * Load a single module by directory name
     */
    private loadModule(dirName: string) {
        try {
            const modulePath = path.join(MODULES_DIR, dirName);
            const manifestPath = path.join(modulePath, "module.json");

            if (!fs.existsSync(manifestPath)) {
                // Not a valid module, skip
                return;
            }

            const manifestContent = fs.readFileSync(manifestPath, "utf-8");
            const manifest = JSON.parse(manifestContent) as ModuleManifest;

            // TODO: Validate manifest against schema

            const loadedModule: LoadedModule = {
                manifest,
                path: modulePath,
                enabled: true, // Default to enabled, later check DB
            };

            this.modules.set(manifest.id, loadedModule);
        } catch (error) {
            console.error(`Failed to load module ${dirName}:`, error);
        }
    }

    /**
     * Get all loaded modules
     */
    public getModules(): LoadedModule[] {
        if (!this.initialized) {
            this.scanModules();
        }
        return Array.from(this.modules.values());
    }

    /**
     * Get a specific module
     */
    public getModule(id: string): LoadedModule | undefined {
        if (!this.initialized) {
            this.scanModules();
        }
        return this.modules.get(id);
    }
}

// Singleton instance
export const moduleLoader = new ModuleLoader();
