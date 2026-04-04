
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

    const imports = `import dynamic from 'next/dynamic';\nimport { PageLoader } from '@/core/components/ui/page-loader';\n\n`;
    let mapping = `export const ModuleRegistry: Record<string, any> = {\n`;
    let apiMapping = `export const ModuleApiRegistry: Record<string, () => Promise<any>> = {\n`;
    const routes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [];
    const apiRoutes: { path: string; key: string; module: string; method?: string }[] = [];

    modules.forEach(moduleName => {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) return;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            // Process Page Routes
            if (manifest.routes) {
                manifest.routes.forEach((route: { path: string; component: string }) => {
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
                manifest.adminRoutes.forEach((route: { path: string; component: string }) => {
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
                manifest.api.forEach((api: { path: string; handler: string; method?: string }) => {
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

    // Collect widgets, navLinks, footerLinks, homepageSections from all modules
    const allWidgets: Record<string, unknown>[] = [];
    const allNavLinks: Record<string, unknown>[] = [];
    const allFooterLinks: Record<string, unknown>[] = [];
    const allDashboardCards: Record<string, unknown>[] = [];
    const allHomepageSections: Record<string, unknown>[] = [];
    const allLayoutComponents: Record<string, unknown>[] = [];
    const allNavbarComponents: Record<string, unknown>[] = [];
    const allSettingsCards: Record<string, unknown>[] = [];
    const allOauthButtons: Record<string, unknown>[] = [];
    const allProfileTabs: Record<string, unknown>[] = [];

    modules.forEach(moduleName => {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) return;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            if (manifest.widgets) {
                manifest.widgets.forEach((w: Record<string, unknown>) => {
                    allWidgets.push({ ...w, module: moduleName });
                });
            }

            if (manifest.navLinks) {
                manifest.navLinks.forEach((link: Record<string, unknown>) => {
                    allNavLinks.push({ ...link, module: moduleName });
                });
            }

            if (manifest.footerLinks) {
                manifest.footerLinks.forEach((link: Record<string, unknown>) => {
                    allFooterLinks.push({ ...link, module: moduleName });
                });
            }

            if (manifest.dashboardCards) {
                manifest.dashboardCards.forEach((card: Record<string, unknown>) => {
                    allDashboardCards.push({ ...card, module: moduleName });
                });
            }

            if (manifest.layoutComponents) {
                manifest.layoutComponents.forEach((lc: Record<string, unknown>) => {
                    allLayoutComponents.push({ ...lc, module: moduleName });
                });
            }

            if (manifest.profileTabs) {
                manifest.profileTabs.forEach((pt: Record<string, unknown>) => {
                    allProfileTabs.push({ ...pt, module: moduleName });
                });
            }

            if (manifest.oauthButtons) {
                manifest.oauthButtons.forEach((btn: Record<string, unknown>) => {
                    allOauthButtons.push({ ...btn, module: moduleName });
                });
            }

            if (manifest.settingsCards) {
                manifest.settingsCards.forEach((sc: Record<string, unknown>) => {
                    allSettingsCards.push({ ...sc, module: moduleName });
                });
            }

            if (manifest.navbarComponents) {
                manifest.navbarComponents.forEach((nc: Record<string, unknown>) => {
                    allNavbarComponents.push({ ...nc, module: moduleName });
                });
            }

            if (manifest.homepageSections) {
                manifest.homepageSections.forEach((section: Record<string, unknown>) => {
                    allHomepageSections.push({ ...section, module: moduleName });
                });
            }
        } catch { /* already logged above */ }
    });

    // Sort navLinks by position, widgets by defaultOrder, homepageSections by order
    allNavLinks.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    allWidgets.sort((a, b) => a.defaultOrder - b.defaultOrder);
    allHomepageSections.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    allNavbarComponents.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    // Generate dynamic imports for widget components
    let widgetImports = '\n// Widget component registry\nexport const WidgetComponentRegistry: Record<string, any> = {\n';
    for (const w of allWidgets) {
        const comp = w.component;
        let importPath = '';
        if (comp.startsWith('@core/')) {
            importPath = `@/core/components/${comp.replace('@core/', '')}`;
        } else {
            importPath = `@/modules/${w.module}/${comp}`;
        }
        // Remove .tsx extension for import
        importPath = importPath.replace(/\.tsx$/, '');
        widgetImports += `  '${w.id}': dynamic(() => import('${importPath}').then(mod => mod.${w.id} || mod.default || mod), { ssr: false }),\n`;
    }
    widgetImports += '};\n\n';

    // Generate dynamic imports for homepage section components
    let homepageSectionImports = '// Homepage section component registry\nexport const HomepageSectionRegistry: Record<string, any> = {\n';
    for (const s of allHomepageSections) {
        const comp = s.component;
        let importPath = '';
        if (comp.startsWith('@core/')) {
            importPath = `@/core/components/${comp.replace('@core/', '')}`;
        } else {
            importPath = `@/modules/${s.module}/${comp}`;
        }
        importPath = importPath.replace(/\.tsx$/, '');
        homepageSectionImports += `  '${s.id}': dynamic(() => import('${importPath}').then(mod => mod.${s.id} || mod.default || mod), { ssr: false }),\n`;
    }
    homepageSectionImports += '};\n\n';

    homepageSectionImports += `export const ModuleHomepageSections: { id: string; type: string; component: string; order: number; module: string }[] = ${JSON.stringify(allHomepageSections, null, 2)};\n\n`;

    let widgetRegistry = `export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = ${JSON.stringify(allWidgets, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = ${JSON.stringify(allNavLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = ${JSON.stringify(allFooterLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleDashboardCards: { id: string; label: string; icon: string; href: string; color: string; statKey: string; module: string }[] = ${JSON.stringify(allDashboardCards, null, 2)};\n\n`;
    // Generate dynamic imports for profile tab components
    allProfileTabs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    let profileTabImports = '// Profile tab component registry\nexport const ProfileTabRegistry: Record<string, any> = {\n';
    for (const pt of allProfileTabs) {
        let importPath = pt.component.startsWith('@core/')
            ? `@/core/components/${pt.component.replace('@core/', '')}`
            : `@/modules/${pt.module}/${pt.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        profileTabImports += `  '${pt.id}': dynamic(() => import('${importPath}').then(mod => mod.${pt.id} || mod.default || mod), { ssr: false }),\n`;
    }
    profileTabImports += '};\n\n';
    profileTabImports += `export const ModuleProfileTabs: { id: string; label: string; component: string; order: number; module: string }[] = ${JSON.stringify(allProfileTabs, null, 2)};\n\n`;

    widgetRegistry += profileTabImports;
    widgetRegistry += `export const ModuleOauthButtons: { id: string; provider: string; label: string; color: string; svgIcon: string; module: string }[] = ${JSON.stringify(allOauthButtons, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleSettingsCards: { title: string; description: string; href: string; icon: string; color: string; module: string }[] = ${JSON.stringify(allSettingsCards, null, 2)};\n`;

    // Generate dynamic imports for layout components
    let layoutImports = '// Layout component registry (rendered on every page)\nexport const LayoutComponentRegistry: Record<string, any> = {\n';
    for (const lc of allLayoutComponents) {
        let importPath = lc.component.startsWith('@core/')
            ? `@/core/components/${lc.component.replace('@core/', '')}`
            : `@/modules/${lc.module}/${lc.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        layoutImports += `  '${lc.id}': dynamic(() => import('${importPath}').then(mod => mod.${lc.id} || mod.default || mod), { ssr: false }),\n`;
    }
    layoutImports += '};\n\n';
    layoutImports += `export const ModuleLayoutComponents: { id: string; component: string; module: string }[] = ${JSON.stringify(allLayoutComponents, null, 2)};\n\n`;

    // Generate dynamic imports for navbar components
    let navbarImports = '// Navbar component registry (rendered in navbar right side)\nexport const NavbarComponentRegistry: Record<string, any> = {\n';
    for (const nc of allNavbarComponents) {
        let importPath = nc.component.startsWith('@core/')
            ? `@/core/components/${nc.component.replace('@core/', '')}`
            : `@/modules/${nc.module}/${nc.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        navbarImports += `  '${nc.id}': dynamic(() => import('${importPath}').then(mod => mod.${nc.id} || mod.default || mod), { ssr: false }),\n`;
    }
    navbarImports += '};\n\n';
    navbarImports += `export const ModuleNavbarComponents: { id: string; component: string; order: number; module: string }[] = ${JSON.stringify(allNavbarComponents, null, 2)};\n\n`;

    const content = imports + mapping + "\n\n" + apiMapping + "\n" + widgetImports + homepageSectionImports + layoutImports + navbarImports + widgetRegistry;

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
