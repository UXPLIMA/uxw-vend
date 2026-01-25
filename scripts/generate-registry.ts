
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

    mapping += `export const ModuleRoutes = ${JSON.stringify(routes, null, 2)};\n\n`;
    mapping += `export const ModuleApiRoutes = ${JSON.stringify(apiRoutes, null, 2)};`;

    const content = imports + mapping + "\n\n" + apiMapping;

    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Generated module registry at ${OUTPUT_FILE}`);
}

generateRegistry();
