
import fs from 'fs';
import path from 'path';

/** Convert a file basename (kebab/snake/PascalCase) to a valid JS identifier (PascalCase) */
function toComponentName(basename: string): string {
    return basename
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

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

    const imports = `/* eslint-disable */\nimport dynamic from 'next/dynamic';\nimport { PageLoader } from '@/core/components/ui/page-loader';\n\n`;
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

                    mapping += `  '${componentKey}': dynamic(() => import('${importPath}').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),\n`;

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

                    mapping += `  '${componentKey}': dynamic(() => import('${importPath}').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),\n`;

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

    // Typed interfaces for manifest collections
    interface ManifestItem { module: string; [key: string]: string | number | boolean | undefined }
    interface WidgetItem extends ManifestItem { id: string; component: string; defaultOrder: number; defaultVisible: boolean }
    interface NavLinkItem extends ManifestItem { label: string; href: string; icon?: string; position?: number }
    interface SectionItem extends ManifestItem { id: string; component: string; order?: number }

    const allWidgets: WidgetItem[] = [];
    const allNavLinks: NavLinkItem[] = [];
    const allFooterLinks: ManifestItem[] = [];
    const allDashboardCards: ManifestItem[] = [];
    const allHomepageSections: SectionItem[] = [];
    const allLayoutComponents: SectionItem[] = [];
    const allNavbarComponents: SectionItem[] = [];
    const allFooterComponents: SectionItem[] = [];
    const allSettingsCards: ManifestItem[] = [];
    const allOauthButtons: ManifestItem[] = [];
    const allProfileTabs: SectionItem[] = [];
    interface StorageProviderItem { id: string; name: string; handler: string; module: string }
    const allStorageProviders: StorageProviderItem[] = [];
    const allContextProviders: SectionItem[] = [];
    interface HookListenerItem { hook: string; type: "action" | "filter"; handler: string; priority?: number; module: string }
    const allHookListeners: HookListenerItem[] = [];
    interface SlotContentItem { id: string; slot: string; component: string; order?: number; module: string }
    const allSlotContents: SlotContentItem[] = [];
    interface PageBlockItem { id: string; category?: string; component: string; module: string }
    const allPageBlocks: PageBlockItem[] = [];

    modules.forEach(moduleName => {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) return;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            if (manifest.widgets) {
                manifest.widgets.forEach((w: { id: string; component: string; defaultOrder: number; defaultVisible: boolean }) => {
                    allWidgets.push({ ...w, module: moduleName });
                });
            }

            if (manifest.navLinks) {
                manifest.navLinks.forEach((link: { label: string; href: string; icon?: string; position?: number; section?: string }) => {
                    allNavLinks.push({ ...link, module: moduleName });
                });
            }

            if (manifest.footerLinks) {
                manifest.footerLinks.forEach((link: { label: string; href: string; icon?: string; position?: number; section?: string }) => {
                    allFooterLinks.push({ ...link, module: moduleName });
                });
            }

            if (manifest.dashboardCards) {
                manifest.dashboardCards.forEach((card: { id: string; label: string; labelKey?: string; icon: string; href: string; color: string; statKey: string }) => {
                    allDashboardCards.push({ ...card, module: moduleName });
                });
            }

            if (manifest.layoutComponents) {
                manifest.layoutComponents.forEach((lc: { id: string; component: string }) => {
                    allLayoutComponents.push({ ...lc, module: moduleName });
                });
            }

            if (manifest.profileTabs) {
                manifest.profileTabs.forEach((pt: { id: string; label: string; component: string; order: number }) => {
                    allProfileTabs.push({ ...pt, module: moduleName });
                });
            }

            if (manifest.oauthButtons) {
                manifest.oauthButtons.forEach((btn: { id: string; provider: string; label: string; color: string; svgIcon: string }) => {
                    allOauthButtons.push({ ...btn, module: moduleName });
                });
            }

            if (manifest.settingsCards) {
                manifest.settingsCards.forEach((sc: { title: string; description: string; href: string; icon: string; color: string }) => {
                    allSettingsCards.push({ ...sc, module: moduleName });
                });
            }

            if (manifest.navbarComponents) {
                manifest.navbarComponents.forEach((nc: { id: string; component: string; order: number }) => {
                    allNavbarComponents.push({ ...nc, module: moduleName });
                });
            }

            if (manifest.footerComponents) {
                manifest.footerComponents.forEach((fc: { id: string; component: string; section?: string; order?: number }) => {
                    allFooterComponents.push({ ...fc, module: moduleName });
                });
            }

            if (manifest.storageProviders) {
                manifest.storageProviders.forEach((sp: { id: string; name: string; handler: string }) => {
                    allStorageProviders.push({ ...sp, module: moduleName });
                });
            }

            if (manifest.contextProviders) {
                manifest.contextProviders.forEach((cp: { id: string; component: string; order?: number }) => {
                    allContextProviders.push({ ...cp, module: moduleName });
                });
            }

            if (manifest.hookListeners) {
                manifest.hookListeners.forEach((hl: { hook: string; type: "action" | "filter"; handler: string; priority?: number }) => {
                    allHookListeners.push({ ...hl, module: moduleName });
                });
            }

            if (manifest.slotContents) {
                manifest.slotContents.forEach((sc: { id: string; slot: string; component: string; order?: number }) => {
                    allSlotContents.push({ ...sc, module: moduleName });
                });
            }

            if (manifest.pageBlocks) {
                manifest.pageBlocks.forEach((pb: { id: string; category?: string; component: string }) => {
                    allPageBlocks.push({ ...pb, module: moduleName });
                });
            }

            if (manifest.homepageSections) {
                manifest.homepageSections.forEach((section: { id: string; component: string; order: number }) => {
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
    allFooterComponents.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

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
        const baseName = toComponentName(path.basename(importPath));
        widgetImports += `  '${w.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${w.id} || mod.default || mod), { loading: () => null }),\n`;
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
        const baseName = toComponentName(path.basename(importPath));
        homepageSectionImports += `  '${s.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${s.id} || mod.default || mod), { loading: () => null }),\n`;
    }
    homepageSectionImports += '};\n\n';

    homepageSectionImports += `export const ModuleHomepageSections: { id: string; type: string; component: string; order: number; module: string }[] = ${JSON.stringify(allHomepageSections, null, 2)};\n\n`;

    let widgetRegistry = `export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = ${JSON.stringify(allWidgets, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = ${JSON.stringify(allNavLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = ${JSON.stringify(allFooterLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleDashboardCards: { id: string; label: string; labelKey?: string; icon: string; href: string; color: string; statKey: string; module: string }[] = ${JSON.stringify(allDashboardCards, null, 2)};\n\n`;
    // Generate dynamic imports for profile tab components
    allProfileTabs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    let profileTabImports = '// Profile tab component registry\nexport const ProfileTabRegistry: Record<string, any> = {\n';
    for (const pt of allProfileTabs) {
        let importPath = pt.component.startsWith('@core/')
            ? `@/core/components/${pt.component.replace('@core/', '')}`
            : `@/modules/${pt.module}/${pt.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        const baseName = toComponentName(path.basename(importPath));
        profileTabImports += `  '${pt.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${pt.id} || mod.default || mod), { loading: () => null }),\n`;
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
        const baseName = toComponentName(path.basename(importPath));
        layoutImports += `  '${lc.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${lc.id} || mod.default || mod), { loading: () => null }),\n`;
    }
    layoutImports += '};\n\n';
    layoutImports += `export const ModuleLayoutComponents: { id: string; component: string; module: string; include?: string[]; exclude?: string[] }[] = ${JSON.stringify(allLayoutComponents, null, 2)};\n\n`;

    // Generate dynamic imports for navbar components
    let navbarImports = '// Navbar component registry (rendered in navbar right side)\nexport const NavbarComponentRegistry: Record<string, any> = {\n';
    for (const nc of allNavbarComponents) {
        let importPath = nc.component.startsWith('@core/')
            ? `@/core/components/${nc.component.replace('@core/', '')}`
            : `@/modules/${nc.module}/${nc.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        const baseName = toComponentName(path.basename(importPath));
        navbarImports += `  '${nc.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${nc.id} || mod.default || mod), { loading: () => null }),\n`;
    }
    navbarImports += '};\n\n';
    navbarImports += `export const ModuleNavbarComponents: { id: string; component: string; order: number; module: string }[] = ${JSON.stringify(allNavbarComponents, null, 2)};\n\n`;

    // Generate dynamic imports for footer components
    let footerImports = '// Footer component registry (rendered in site footer)\nexport const FooterComponentRegistry: Record<string, any> = {\n';
    for (const fc of allFooterComponents) {
        let importPath = fc.component.startsWith('@core/')
            ? `@/core/components/${fc.component.replace('@core/', '')}`
            : `@/modules/${fc.module}/${fc.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        const baseName = toComponentName(path.basename(importPath));
        footerImports += `  '${fc.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${fc.id} || mod.default || mod), { loading: () => null }),\n`;
    }
    footerImports += '};\n\n';
    footerImports += `export const ModuleFooterComponents: { id: string; component: string; section?: string; order?: number; module: string }[] = ${JSON.stringify(allFooterComponents, null, 2)};\n\n`;

    // Generate dynamic imports for context providers (wrap children, not siblings)
    allContextProviders.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    let contextImports = '// Context provider registry — wraps children, used for React contexts\nexport const ContextProviderRegistry: Record<string, any> = {\n';
    for (const cp of allContextProviders) {
        let importPath = cp.component.startsWith('@core/')
            ? `@/core/components/${cp.component.replace('@core/', '')}`
            : `@/modules/${cp.module}/${cp.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        const baseName = toComponentName(path.basename(importPath));
        contextImports += `  '${cp.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${cp.id} || mod.${baseName} || mod.default || mod), { ssr: true, loading: () => null }),\n`;
    }
    contextImports += '};\n\n';
    contextImports += `export const ModuleContextProviders: { id: string; component: string; order?: number; module: string }[] = ${JSON.stringify(allContextProviders, null, 2)};\n\n`;

    // Generate dynamic imports for slot contents (template injection points)
    let slotImports = '// Slot content registry — modules injecting into other modules\' named slots\nexport const SlotContentRegistry: Record<string, any> = {\n';
    for (const sc of allSlotContents) {
        let importPath = sc.component.startsWith('@core/')
            ? `@/core/components/${sc.component.replace('@core/', '')}`
            : `@/modules/${sc.module}/${sc.component}`;
        importPath = importPath.replace(/\.tsx$/, '');
        const baseName = toComponentName(path.basename(importPath));
        slotImports += `  '${sc.id}': dynamic(() => import('${importPath}').then((mod: any) => mod.${baseName} || mod.${sc.id} || mod.default || mod), { loading: () => null }),\n`;
    }
    slotImports += '};\n\n';
    slotImports += `export const ModuleSlotContents: { id: string; slot: string; component: string; order?: number; module: string }[] = ${JSON.stringify(allSlotContents, null, 2)};\n\n`;

    const content = imports + mapping + "\n\n" + apiMapping + "\n" + widgetImports + homepageSectionImports + layoutImports + navbarImports + footerImports + contextImports + slotImports + widgetRegistry;

    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Generated module registry at ${OUTPUT_FILE}`);

    // Generate server-safe data file (no dynamic imports, safe for API routes)
    const DATA_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-data.ts');
    let dataContent = '// Auto-generated server-safe module data - no dynamic imports\n';
    dataContent += `export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = ${JSON.stringify(apiRoutes, null, 2)};\n\n`;
    dataContent += `export const ModuleRoutesList: { path: string; key: string; module: string; isAdmin?: boolean }[] = ${JSON.stringify(routes, null, 2)};\n`;
    fs.writeFileSync(DATA_FILE, dataContent);

    // Generate server-only hook listener registry
    // Loaded once at server startup by initModuleHooks() — registers each
    // listener with the core hooks runtime. No React, no dynamic().
    const HOOKS_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-hooks.ts');
    let hooksContent = '// Auto-generated hook listener registry — server only\n';
    hooksContent += '// Imports each listener as a plain dynamic import so it can be registered\n';
    hooksContent += '// into the core hooks runtime at initialization.\n\n';
    hooksContent += `export const ModuleHookListeners: { hook: string; type: "action" | "filter"; module: string; priority?: number; loader: () => Promise<{ default: (...args: unknown[]) => unknown }> }[] = [\n`;
    for (const hl of allHookListeners) {
        const handlerPath = hl.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${hl.module}/${handlerPath}`;
        hooksContent += `  { hook: ${JSON.stringify(hl.hook)}, type: ${JSON.stringify(hl.type)}, module: ${JSON.stringify(hl.module)}, priority: ${hl.priority ?? 10}, loader: () => import('${importPath}') as Promise<{ default: (...args: unknown[]) => unknown }> },\n`;
    }
    hooksContent += '];\n';
    fs.writeFileSync(HOOKS_FILE, hooksContent);

    // Generate server-only storage provider registry (no React, no dynamic())
    // storage.ts dynamically imports this file to resolve the active provider.
    const STORAGE_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-storage.ts');
    let storageContent = '// Auto-generated server-only storage provider registry\n';
    storageContent += '// Plain dynamic import() — no React/Next dynamic. Safe for server contexts.\n\n';
    storageContent += 'export const StorageProviderRegistry: Record<string, () => Promise<{ upload: (buffer: Buffer, filename: string, mimeType: string) => Promise<{ url: string; path: string }> }>> = {\n';
    for (const sp of allStorageProviders) {
        const handlerPath = sp.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${sp.module}/${handlerPath}`;
        storageContent += `  '${sp.id}': () => import('${importPath}').then((mod) => mod.default || mod),\n`;
    }
    storageContent += '};\n\n';
    storageContent += `export const ModuleStorageProviders = ${JSON.stringify(allStorageProviders, null, 2)};\n`;
    fs.writeFileSync(STORAGE_FILE, storageContent);

    // Generate page-builder blocks registry — dynamic imports of each
    // module block file's default export. Used by both the editor and
    // the public renderer to extend the core Puck block library.
    const BLOCKS_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-blocks.ts');
    let blocksContent = '// Auto-generated page-builder blocks registry\n';
    blocksContent += '// Each entry points to a module file exporting a Puck ComponentConfig\n';
    blocksContent += '// as its default export.\n\n';
    blocksContent += 'export const ModulePageBlocks: { id: string; category?: string; component: string; module: string; loader: () => Promise<{ default: unknown }> }[] = [\n';
    for (const pb of allPageBlocks) {
        const handlerPath = pb.component.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${pb.module}/${handlerPath}`;
        blocksContent += `  { id: ${JSON.stringify(pb.id)}, category: ${JSON.stringify(pb.category || 'modules')}, component: ${JSON.stringify(pb.component)}, module: ${JSON.stringify(pb.module)}, loader: () => import('${importPath}') },\n`;
    }
    blocksContent += '];\n';
    fs.writeFileSync(BLOCKS_FILE, blocksContent);
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
