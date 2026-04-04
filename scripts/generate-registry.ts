
import fs from 'fs';
import path from 'path';

const MODULES_DIR = path.join(process.cwd(), 'src/modules');
const OUTPUT_FILE = path.join(process.cwd(), 'src/core/generated/module-registry.tsx');

function generateRegistry() {
    if (!fs.existsSync(MODULES_DIR)) {
        console.log('Modules directory not found.');
        return;
    }

    const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    let imports = `import dynamic from 'next/dynamic';\nimport { PageLoader } from '@/core/components/ui/page-loader';\n\n`;
    let mapping = `export const ModuleRegistry: Record<string, any> = {\n`;
    let apiMapping = `export const ModuleApiRegistry: Record<string, () => Promise<any>> = {\n`;
    const routes: any[] = [];
    const apiRoutes: any[] = [];

    modules.forEach(moduleName => {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) return;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            // Process Page Routes
            if (manifest.routes) {
                manifest.routes.forEach((route: any) => {
                    const componentKey = `${moduleName}:${route.component}`;
                    const importPath = `@/modules/${moduleName}/${route.component.replace(/\.tsx?$/, '')}`;

                    mapping += `  '${componentKey}': dynamic(() => import('${importPath}').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),\n`;

                    routes.push({
                        path: route.path,
                        key: componentKey,
                        module: moduleName
                    });
                });
            }

            // Process Admin Routes
            if (manifest.adminRoutes) {
                manifest.adminRoutes.forEach((route: any) => {
                    const componentKey = `${moduleName}:${route.component}`;
                    const importPath = `@/modules/${moduleName}/${route.component.replace(/\.tsx?$/, '')}`;
                    // Admin routes often start with /admin in the path, but let's ensure consistency
                    // If manifest says "/store/products", the full URL is "/admin/store/products"
                    // We will store the relative path (without /admin prefix) in the registry for the admin specific matcher to use?
                    // OR we store the full path to be safe. 
                    // Let's assume manifest path is relative to /admin.

                    const fullPath = `/admin${route.path.startsWith('/') ? route.path : '/' + route.path}`;

                    mapping += `  '${componentKey}': dynamic(() => import('${importPath}').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),\n`;

                    routes.push({
                        path: fullPath,
                        key: componentKey,
                        module: moduleName,
                        isAdmin: true
                    });
                });
            }

            // Process API Routes
            if (manifest.api) {
                manifest.api.forEach((api: any) => {
                    const apiKey = `${moduleName}:api:${api.path}`;
                    const handlerImportPath = `@/modules/${moduleName}/${api.handler.replace(/\.ts?$/, '')}`;

                    apiMapping += `  '${apiKey}': () => import('${handlerImportPath}'),\n`;

                    apiRoutes.push({
                        path: api.path, // e.g. /blog/articles
                        key: apiKey,
                        module: moduleName,
                        method: api.method || "ALL"
                    });
                });
            }
        } catch (e) {
            console.error(`Error parsing manifest for ${moduleName}:`, e);
        }
    });

    mapping += `};\n\n`;
    apiMapping += `};\n\n`;

    mapping += `export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = ${JSON.stringify(routes, null, 2)};\n\n`;
    mapping += `export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = ${JSON.stringify(apiRoutes, null, 2)};`;

    // Collect widgets, navLinks, footerLinks from all modules
    const allWidgets: any[] = [];
    const allNavLinks: any[] = [];
    const allFooterLinks: any[] = [];
    const allDashboardCards: any[] = [];

    modules.forEach(moduleName => {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) return;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            if (manifest.widgets) {
                manifest.widgets.forEach((w: any) => {
                    allWidgets.push({ ...w, module: moduleName });
                });
            }

            if (manifest.navLinks) {
                manifest.navLinks.forEach((link: any) => {
                    allNavLinks.push({ ...link, module: moduleName });
                });
            }

            if (manifest.footerLinks) {
                manifest.footerLinks.forEach((link: any) => {
                    allFooterLinks.push({ ...link, module: moduleName });
                });
            }

            if (manifest.dashboardCards) {
                manifest.dashboardCards.forEach((card: any) => {
                    allDashboardCards.push({ ...card, module: moduleName });
                });
            }
        } catch { /* already logged above */ }
    });

    // Sort navLinks by position, widgets by defaultOrder
    allNavLinks.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    allWidgets.sort((a, b) => a.defaultOrder - b.defaultOrder);

    let widgetRegistry = `export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = ${JSON.stringify(allWidgets, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = ${JSON.stringify(allNavLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = ${JSON.stringify(allFooterLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleDashboardCards: { id: string; label: string; icon: string; href: string; color: string; statKey: string; module: string }[] = ${JSON.stringify(allDashboardCards, null, 2)};\n`;

    const content = imports + mapping + "\n\n" + apiMapping + "\n" + widgetRegistry;

    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Generated module registry at ${OUTPUT_FILE}`);
}

const ROUTES_OUTPUT_FILE = path.join(process.cwd(), 'src/core/generated/module-routes.ts');

function generateModuleRoutes() {
    if (!fs.existsSync(MODULES_DIR)) {
        console.log('Modules directory not found.');
        return;
    }

    const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const modulePatterns: Record<string, Set<string>> = {};

    modules.forEach(moduleName => {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) return;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const patterns = new Set<string>();

            // Public routes: extract first path segment, generate locale-prefixed pattern
            if (manifest.routes) {
                for (const route of manifest.routes) {
                    const routePath: string = route.path;
                    const match = routePath.match(/^\/([^/[]+)/);
                    if (match) {
                        const prefix = match[1];
                        patterns.add(`/^\\\/[a-z]{2}\\/${escapeRegex(prefix)}/`);
                    }
                }
            }

            // Admin routes: extract first path segment, generate locale+admin prefixed pattern
            if (manifest.adminRoutes) {
                for (const route of manifest.adminRoutes) {
                    const routePath: string = route.path;
                    const match = routePath.match(/^\/([^/[]+)/);
                    if (match) {
                        const prefix = match[1];
                        patterns.add(`/^\\\/[a-z]{2}\\\/admin\\/${escapeRegex(prefix)}/`);
                    }
                }
            }

            // API routes: extract ALL unique first-level path segments
            if (manifest.api) {
                for (const api of manifest.api) {
                    const apiPath: string = api.path;
                    const match = apiPath.match(/^\/([^/[]+)/);
                    if (match) {
                        const prefix = match[1];
                        patterns.add(`/^\\\/api\\\/v1\\/${escapeRegex(prefix)}/`);
                    }
                }
            }

            if (patterns.size > 0) {
                modulePatterns[moduleName] = patterns;
            }
        } catch (e) {
            console.error(`Error parsing manifest for ${moduleName}:`, e);
        }
    });

    // Generate output
    let output = '// Auto-generated by scripts/generate-registry.ts - do not edit\n';
    output += 'export const moduleRouteMap: Record<string, RegExp[]> = {\n';

    for (const [moduleName, patterns] of Object.entries(modulePatterns)) {
        output += `  "${moduleName}": [\n`;
        for (const pattern of patterns) {
            output += `    ${pattern},\n`;
        }
        output += `  ],\n`;
    }

    output += '};\n';

    const dir = path.dirname(ROUTES_OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(ROUTES_OUTPUT_FILE, output);
    console.log(`Generated module routes at ${ROUTES_OUTPUT_FILE}`);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

generateRegistry();
generateModuleRoutes();
