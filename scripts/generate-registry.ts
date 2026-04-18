import fs from 'fs';
import path from 'path';
import { moduleManifestSchema, type ValidatedModuleManifest } from '../src/core/lib/module-manifest-schema';

function toComponentName(basename: string): string {
    return basename
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

const MODULES_DIR = path.join(process.cwd(), 'src/modules');
const OUTPUT_FILE = path.join(process.cwd(), 'src/core/generated/module-registry.tsx');

interface LoadedManifest {
    moduleName: string;
    manifest: ValidatedModuleManifest;
}

function loadManifests(): LoadedManifest[] {
    if (!fs.existsSync(MODULES_DIR)) {
        return [];
    }

    const moduleDirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    const loaded: LoadedManifest[] = [];
    for (const moduleName of moduleDirs) {
        const manifestPath = path.join(MODULES_DIR, moduleName, 'module.json');
        if (!fs.existsSync(manifestPath)) continue;

        let raw: unknown;
        try {
            raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (err) {
            console.error(`[registry] ${moduleName}: invalid JSON in module.json —`, (err as Error).message);
            continue;
        }

        const parsed = moduleManifestSchema.safeParse(raw);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const where = first.path.join('.');
            console.error(`[registry] ${moduleName}: manifest schema invalid${where ? ` at ${where}` : ''} — ${first.message}`);
            continue;
        }

        if (parsed.data.id !== moduleName) {
            console.error(`[registry] ${moduleName}: manifest id "${parsed.data.id}" does not match directory name — skipping`);
            continue;
        }

        loaded.push({ moduleName, manifest: parsed.data });
    }

    return loaded;
}

function buildImportPath(component: string, moduleName: string): string {
    const cleaned = component.replace(/\.tsx?$/, '');
    if (cleaned.startsWith('@core/')) {
        return `@/core/components/${cleaned.replace('@core/', '')}`;
    }
    return `@/modules/${moduleName}/${cleaned}`;
}

type ManifestItem = { module: string } & Record<string, string | number | boolean | string[] | undefined>;

function generateRegistry() {
    const loaded = loadManifests();

    const imports = `/* eslint-disable */\nimport dynamic from 'next/dynamic';\nimport type { ComponentType } from 'react';\nimport { PageLoader } from '@/core/components/ui/page-loader';\n\n`;

    let mapping = `export const ModuleRegistry: Record<string, ComponentType<any>> = {\n`;
    let apiMapping = `export const ModuleApiRegistry: Record<string, () => Promise<Record<string, unknown>>> = {\n`;
    const routes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [];
    const apiRoutes: { path: string; key: string; module: string; method?: string }[] = [];

    for (const { moduleName, manifest } of loaded) {
        for (const route of manifest.routes ?? []) {
            const componentKey = `${moduleName}:${route.component}`;
            const importPath = `@/modules/${moduleName}/${route.component.replace(/\.tsx?$/, '')}`;
            mapping += `  '${componentKey}': dynamic(() => import('${importPath}').then((mod: { default?: ComponentType<any> }) => mod.default ?? (mod as unknown as ComponentType<any>)), { loading: () => <PageLoader /> }),\n`;
            routes.push({ path: route.path, key: componentKey, module: moduleName });
        }

        for (const route of manifest.adminRoutes ?? []) {
            const componentKey = `${moduleName}:${route.component}`;
            const importPath = `@/modules/${moduleName}/${route.component.replace(/\.tsx?$/, '')}`;
            const fullPath = `/admin${route.path.startsWith('/') ? route.path : '/' + route.path}`;
            mapping += `  '${componentKey}': dynamic(() => import('${importPath}').then((mod: { default?: ComponentType<any> }) => mod.default ?? (mod as unknown as ComponentType<any>)), { loading: () => <PageLoader /> }),\n`;
            routes.push({ path: fullPath, key: componentKey, module: moduleName, isAdmin: true });
        }

        for (const api of manifest.api ?? []) {
            const apiKey = `${moduleName}:api:${api.path}`;
            const handlerImportPath = `@/modules/${moduleName}/${api.handler.replace(/\.ts?$/, '')}`;
            apiMapping += `  '${apiKey}': () => import('${handlerImportPath}'),\n`;
            apiRoutes.push({ path: api.path, key: apiKey, module: moduleName, method: api.method || 'ALL' });
        }
    }

    mapping += `};\n\n`;
    apiMapping += `};\n\n`;
    mapping += `export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = ${JSON.stringify(routes, null, 2)};\n\n`;
    mapping += `export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = ${JSON.stringify(apiRoutes, null, 2)};`;

    // Aggregate typed collections across all modules
    const allWidgets: ({ id: string; component: string; defaultOrder: number; defaultVisible: boolean; module: string })[] = [];
    const allNavLinks: ({ label: string; href: string; icon?: string; position?: number; module: string })[] = [];
    const allFooterLinks: ManifestItem[] = [];
    const allDashboardCards: ManifestItem[] = [];
    const allHomepageSections: ({ id: string; type: 'content' | 'widget'; component: string; order: number; module: string })[] = [];
    const allLayoutComponents: ({ id: string; component: string; include?: string[]; exclude?: string[]; module: string })[] = [];
    const allNavbarComponents: ({ id: string; component: string; order: number; module: string })[] = [];
    const allFooterComponents: ({ id: string; component: string; section?: string; order?: number; module: string })[] = [];
    const allSettingsCards: ManifestItem[] = [];
    const allOauthButtons: ManifestItem[] = [];
    const allProfileTabs: ({ id: string; label: string; component: string; order: number; module: string })[] = [];
    const allStorageProviders: ({ id: string; name: string; handler: string; module: string })[] = [];
    const allContextProviders: ({ id: string; component: string; order?: number; module: string })[] = [];
    const allHookListeners: ({ hook: string; type: 'action' | 'filter'; handler: string; priority?: number; module: string })[] = [];
    const allSlotContents: ({ id: string; slot: string; component: string; order?: number; module: string })[] = [];
    const allPageBlocks: ({ id: string; category?: string; component: string; module: string })[] = [];
    const allCronJobs: ({ id: string; schedule: string; handler: string; module: string })[] = [];
    const allSearchProviders: ({ id: string; label: string; handler: string; module: string })[] = [];
    const allWebhookReceivers: ({ provider: string; handler: string; signatureHeader?: string; secretEnv?: string; module: string })[] = [];
    const allNotificationTypes: ({ eventType: string; label: string; description?: string; channels?: string[]; module: string })[] = [];
    const allSeoRoutes: ({ module: string; handler: string })[] = [];

    for (const { moduleName, manifest } of loaded) {
        manifest.widgets?.forEach((w) => allWidgets.push({ ...w, module: moduleName }));
        manifest.navLinks?.forEach((l) => allNavLinks.push({ ...l, module: moduleName }));
        manifest.footerLinks?.forEach((l) => allFooterLinks.push({ ...l, module: moduleName }));
        manifest.dashboardCards?.forEach((c) => allDashboardCards.push({ ...c, module: moduleName }));
        manifest.layoutComponents?.forEach((lc) => allLayoutComponents.push({ ...lc, module: moduleName }));
        manifest.profileTabs?.forEach((pt) => allProfileTabs.push({ ...pt, module: moduleName }));
        manifest.oauthButtons?.forEach((btn) => allOauthButtons.push({ ...btn, module: moduleName }));
        manifest.settingsCards?.forEach((sc) => allSettingsCards.push({ ...sc, module: moduleName }));
        manifest.navbarComponents?.forEach((nc) => allNavbarComponents.push({ ...nc, module: moduleName }));
        manifest.footerComponents?.forEach((fc) => allFooterComponents.push({ ...fc, module: moduleName }));
        manifest.storageProviders?.forEach((sp) => allStorageProviders.push({ ...sp, module: moduleName }));
        manifest.contextProviders?.forEach((cp) => allContextProviders.push({ ...cp, module: moduleName }));
        manifest.hookListeners?.forEach((hl) => allHookListeners.push({ ...hl, module: moduleName }));
        manifest.slotContents?.forEach((sc) => allSlotContents.push({ ...sc, module: moduleName }));
        manifest.pageBlocks?.forEach((pb) => allPageBlocks.push({ ...pb, module: moduleName }));
        manifest.cronJobs?.forEach((cj) => allCronJobs.push({ ...cj, module: moduleName }));
        manifest.searchProviders?.forEach((sp) => allSearchProviders.push({ ...sp, module: moduleName }));
        manifest.webhookReceivers?.forEach((wr) => allWebhookReceivers.push({ ...wr, module: moduleName }));
        manifest.notificationTypes?.forEach((nt) => allNotificationTypes.push({ ...nt, module: moduleName }));
        manifest.homepageSections?.forEach((section) => allHomepageSections.push({ ...section, module: moduleName }));
        if (manifest.seoRoutes?.handler) {
            allSeoRoutes.push({ module: moduleName, handler: manifest.seoRoutes.handler });
        }
    }

    allNavLinks.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    allWidgets.sort((a, b) => a.defaultOrder - b.defaultOrder);
    allHomepageSections.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    allNavbarComponents.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    allFooterComponents.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    allContextProviders.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    allProfileTabs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    function emitDynamicRegistry(
        label: string,
        exportName: string,
        items: Array<{ id: string; component: string; module: string }>,
        loadingExpr = 'null',
    ): string {
        let out = `// ${label}\nexport const ${exportName}: Record<string, ComponentType<any>> = {\n`;
        for (const item of items) {
            const importPath = buildImportPath(item.component, item.module);
            const baseName = toComponentName(path.basename(importPath));
            out += `  '${item.id}': dynamic(() => import('${importPath}').then((mod: Record<string, unknown>) => (mod.${baseName} ?? mod['${item.id}'] ?? mod.default ?? mod) as ComponentType<any>), { loading: () => ${loadingExpr} }),\n`;
        }
        out += '};\n\n';
        return out;
    }

    let widgetImports = emitDynamicRegistry('Widget component registry', 'WidgetComponentRegistry', allWidgets);
    let homepageSectionImports = emitDynamicRegistry('Homepage section component registry', 'HomepageSectionRegistry', allHomepageSections);
    homepageSectionImports += `export const ModuleHomepageSections: { id: string; type: string; component: string; order: number; module: string }[] = ${JSON.stringify(allHomepageSections, null, 2)};\n\n`;

    let widgetRegistry = `export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = ${JSON.stringify(allWidgets, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = ${JSON.stringify(allNavLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = ${JSON.stringify(allFooterLinks, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleDashboardCards: { id: string; label: string; labelKey?: string; icon: string; href: string; color: string; statKey: string; module: string }[] = ${JSON.stringify(allDashboardCards, null, 2)};\n\n`;

    let profileTabImports = emitDynamicRegistry('Profile tab component registry', 'ProfileTabRegistry', allProfileTabs);
    profileTabImports += `export const ModuleProfileTabs: { id: string; label: string; component: string; order: number; module: string }[] = ${JSON.stringify(allProfileTabs, null, 2)};\n\n`;

    widgetRegistry += profileTabImports;
    widgetRegistry += `export const ModuleOauthButtons: { id: string; provider: string; label: string; color: string; svgIcon: string; module: string }[] = ${JSON.stringify(allOauthButtons, null, 2)};\n\n`;
    widgetRegistry += `export const ModuleSettingsCards: { title: string; description: string; href: string; icon: string; color: string; module: string }[] = ${JSON.stringify(allSettingsCards, null, 2)};\n`;

    let layoutImports = emitDynamicRegistry('Layout component registry (rendered on every page)', 'LayoutComponentRegistry', allLayoutComponents);
    layoutImports += `export const ModuleLayoutComponents: { id: string; component: string; module: string; include?: string[]; exclude?: string[] }[] = ${JSON.stringify(allLayoutComponents, null, 2)};\n\n`;

    let navbarImports = emitDynamicRegistry('Navbar component registry (rendered in navbar right side)', 'NavbarComponentRegistry', allNavbarComponents);
    navbarImports += `export const ModuleNavbarComponents: { id: string; component: string; order: number; module: string }[] = ${JSON.stringify(allNavbarComponents, null, 2)};\n\n`;

    let footerImports = emitDynamicRegistry('Footer component registry (rendered in site footer)', 'FooterComponentRegistry', allFooterComponents);
    footerImports += `export const ModuleFooterComponents: { id: string; component: string; section?: string; order?: number; module: string }[] = ${JSON.stringify(allFooterComponents, null, 2)};\n\n`;

    let contextImports = '// Context provider registry — wraps children, used for React contexts\n';
    contextImports += `export const ContextProviderRegistry: Record<string, ComponentType<any>> = {\n`;
    for (const cp of allContextProviders) {
        const importPath = buildImportPath(cp.component, cp.module);
        const baseName = toComponentName(path.basename(importPath));
        contextImports += `  '${cp.id}': dynamic(() => import('${importPath}').then((mod: Record<string, unknown>) => (mod['${cp.id}'] ?? mod.${baseName} ?? mod.default ?? mod) as ComponentType<any>), { ssr: true, loading: () => null }),\n`;
    }
    contextImports += '};\n\n';
    contextImports += `export const ModuleContextProviders: { id: string; component: string; order?: number; module: string }[] = ${JSON.stringify(allContextProviders, null, 2)};\n\n`;

    let slotImports = emitDynamicRegistry("Slot content registry — modules injecting into other modules' named slots", 'SlotContentRegistry', allSlotContents);
    slotImports += `export const ModuleSlotContents: { id: string; slot: string; component: string; order?: number; module: string }[] = ${JSON.stringify(allSlotContents, null, 2)};\n\n`;

    const content = imports + mapping + '\n\n' + apiMapping + '\n' + widgetImports + homepageSectionImports + layoutImports + navbarImports + footerImports + contextImports + slotImports + widgetRegistry;

    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Generated module registry at ${OUTPUT_FILE}`);

    const DATA_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-data.ts');
    let dataContent = '// Auto-generated server-safe module data - no dynamic imports\n';
    dataContent += `export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = ${JSON.stringify(apiRoutes, null, 2)};\n\n`;
    dataContent += `export const ModuleRoutesList: { path: string; key: string; module: string; isAdmin?: boolean }[] = ${JSON.stringify(routes, null, 2)};\n`;
    fs.writeFileSync(DATA_FILE, dataContent);

    const HOOKS_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-hooks.ts');
    let hooksContent = '// Auto-generated hook listener registry — server only\n\n';
    hooksContent += `export const ModuleHookListeners: { hook: string; type: "action" | "filter"; module: string; priority?: number; loader: () => Promise<{ default: (...args: unknown[]) => unknown }> }[] = [\n`;
    for (const hl of allHookListeners) {
        const handlerPath = hl.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${hl.module}/${handlerPath}`;
        hooksContent += `  { hook: ${JSON.stringify(hl.hook)}, type: ${JSON.stringify(hl.type)}, module: ${JSON.stringify(hl.module)}, priority: ${hl.priority ?? 10}, loader: () => import('${importPath}') as Promise<{ default: (...args: unknown[]) => unknown }> },\n`;
    }
    hooksContent += '];\n';
    fs.writeFileSync(HOOKS_FILE, hooksContent);

    const STORAGE_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-storage.ts');
    let storageContent = '// Auto-generated server-only storage provider registry\n\n';
    storageContent += 'export const StorageProviderRegistry: Record<string, () => Promise<{ upload: (buffer: Buffer, filename: string, mimeType: string) => Promise<{ url: string; path: string }> }>> = {\n';
    for (const sp of allStorageProviders) {
        const handlerPath = sp.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${sp.module}/${handlerPath}`;
        storageContent += `  '${sp.id}': () => import('${importPath}').then((mod) => mod.default || mod),\n`;
    }
    storageContent += '};\n\n';
    storageContent += `export const ModuleStorageProviders = ${JSON.stringify(allStorageProviders, null, 2)};\n`;
    fs.writeFileSync(STORAGE_FILE, storageContent);

    const BLOCKS_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-blocks.ts');
    let blocksContent = '// Auto-generated page-builder blocks registry\n\n';
    blocksContent += 'export const ModulePageBlocks: { id: string; category?: string; component: string; module: string; loader: () => Promise<{ default: unknown }> }[] = [\n';
    for (const pb of allPageBlocks) {
        const handlerPath = pb.component.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${pb.module}/${handlerPath}`;
        blocksContent += `  { id: ${JSON.stringify(pb.id)}, category: ${JSON.stringify(pb.category || 'modules')}, component: ${JSON.stringify(pb.component)}, module: ${JSON.stringify(pb.module)}, loader: () => import('${importPath}') },\n`;
    }
    blocksContent += '];\n';
    fs.writeFileSync(BLOCKS_FILE, blocksContent);

    const CRONS_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-crons.ts');
    let cronsContent = '// Auto-generated module cron jobs registry\n\n';
    cronsContent += 'export const ModuleCronJobs: { id: string; schedule: string; module: string; loader: () => Promise<{ default: () => Promise<void> }> }[] = [\n';
    for (const cj of allCronJobs) {
        const handlerPath = cj.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${cj.module}/${handlerPath}`;
        cronsContent += `  { id: ${JSON.stringify(cj.id)}, schedule: ${JSON.stringify(cj.schedule)}, module: ${JSON.stringify(cj.module)}, loader: () => import('${importPath}') as Promise<{ default: () => Promise<void> }> },\n`;
    }
    cronsContent += '];\n';
    fs.writeFileSync(CRONS_FILE, cronsContent);

    const SEARCH_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-search.ts');
    let searchContent = '// Auto-generated public search providers registry\n\n';
    searchContent += 'export const ModuleSearchProviders: { id: string; label: string; module: string; loader: () => Promise<{ default: (query: string) => Promise<unknown[]> }> }[] = [\n';
    for (const sp of allSearchProviders) {
        const handlerPath = sp.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${sp.module}/${handlerPath}`;
        searchContent += `  { id: ${JSON.stringify(sp.id)}, label: ${JSON.stringify(sp.label)}, module: ${JSON.stringify(sp.module)}, loader: () => import('${importPath}') as Promise<{ default: (query: string) => Promise<unknown[]> }> },\n`;
    }
    searchContent += '];\n';
    fs.writeFileSync(SEARCH_FILE, searchContent);

    const WEBHOOKS_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-webhooks.ts');
    let webhooksContent = '// Auto-generated inbound webhook receivers registry\n\n';
    webhooksContent += 'export const ModuleWebhookReceivers: { provider: string; module: string; signatureHeader?: string; secretEnv?: string; loader: () => Promise<{ default: (request: Request) => Promise<{ status: number; body?: unknown }> }> }[] = [\n';
    for (const wr of allWebhookReceivers) {
        const handlerPath = wr.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${wr.module}/${handlerPath}`;
        const sigHeader = wr.signatureHeader ? JSON.stringify(wr.signatureHeader) : 'undefined';
        const secretEnv = wr.secretEnv ? JSON.stringify(wr.secretEnv) : 'undefined';
        webhooksContent += `  { provider: ${JSON.stringify(wr.provider)}, module: ${JSON.stringify(wr.module)}, signatureHeader: ${sigHeader}, secretEnv: ${secretEnv}, loader: () => import('${importPath}') as Promise<{ default: (request: Request) => Promise<{ status: number; body?: unknown }> }> },\n`;
    }
    webhooksContent += '];\n';
    fs.writeFileSync(WEBHOOKS_FILE, webhooksContent);

    const SEO_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-seo.ts');
    let seoContent = '// Auto-generated module SEO sitemap registry — server only\n\n';
    seoContent += 'export interface SitemapEntry {\n';
    seoContent += '    url: string;\n';
    seoContent += '    lastModified?: Date;\n';
    seoContent += "    changeFreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';\n";
    seoContent += '    priority?: number;\n';
    seoContent += '}\n\n';
    seoContent += 'export const ModuleSeoRoutes: { module: string; loader: () => Promise<{ default: () => Promise<SitemapEntry[]> }> }[] = [\n';
    for (const sr of allSeoRoutes) {
        const handlerPath = sr.handler.replace(/\.tsx?$/, '');
        const importPath = `@/modules/${sr.module}/${handlerPath}`;
        seoContent += `  { module: ${JSON.stringify(sr.module)}, loader: () => import('${importPath}') as Promise<{ default: () => Promise<SitemapEntry[]> }> },\n`;
    }
    seoContent += '];\n';
    fs.writeFileSync(SEO_FILE, seoContent);

    const NOTIFTYPES_FILE = path.join(path.dirname(OUTPUT_FILE), 'module-notification-types.ts');
    let notifTypesContent = '// Auto-generated notification types registry\n\n';
    notifTypesContent += `export const ModuleNotificationTypes: { eventType: string; label: string; description?: string; channels?: string[]; module: string }[] = ${JSON.stringify(allNotificationTypes, null, 2)};\n`;
    fs.writeFileSync(NOTIFTYPES_FILE, notifTypesContent);
}

const ROUTES_OUTPUT_FILE = path.join(process.cwd(), 'src/core/generated/module-routes.ts');

function generateModuleRoutes() {
    const loaded = loadManifests();
    const modulePatterns: Record<string, Set<string>> = {};

    for (const { moduleName, manifest } of loaded) {
        const patterns = new Set<string>();

        for (const route of manifest.routes ?? []) {
            const match = route.path.match(/^\/([^/[]+)/);
            if (match) {
                patterns.add(`/^\\\/[a-z]{2}\\/${escapeRegex(match[1])}/`);
            }
        }

        for (const route of manifest.adminRoutes ?? []) {
            const match = route.path.match(/^\/([^/[]+)/);
            if (match) {
                patterns.add(`/^\\\/[a-z]{2}\\\/admin\\/${escapeRegex(match[1])}/`);
            }
        }

        for (const api of manifest.api ?? []) {
            const match = api.path.match(/^\/([^/[]+)/);
            if (match) {
                patterns.add(`/^\\\/api\\\/v1\\/${escapeRegex(match[1])}/`);
            }
        }

        if (patterns.size > 0) {
            modulePatterns[moduleName] = patterns;
        }
    }

    let output = '// Auto-generated by scripts/generate-registry.ts - do not edit\n';
    output += 'export const moduleRouteMap: Record<string, RegExp[]> = {\n';
    for (const [moduleName, patterns] of Object.entries(modulePatterns)) {
        output += `  "${moduleName}": [\n`;
        for (const pattern of patterns) output += `    ${pattern},\n`;
        output += `  ],\n`;
    }
    output += '};\n';

    const dir = path.dirname(ROUTES_OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ROUTES_OUTPUT_FILE, output);
    console.log(`Generated module routes at ${ROUTES_OUTPUT_FILE}`);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

generateRegistry();
generateModuleRoutes();
