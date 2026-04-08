// Auto-generated server-only storage provider registry
// Plain dynamic import() — no React/Next dynamic. Safe for server contexts.

export const StorageProviderRegistry: Record<string, () => Promise<{ upload: (buffer: Buffer, filename: string, mimeType: string) => Promise<{ url: string; path: string }> }>> = {
  'cloudflare-r2': () => import('@/modules/cloudflare-r2/lib/provider').then((mod) => mod.default || mod),
};

export const ModuleStorageProviders = [
  {
    "id": "cloudflare-r2",
    "name": "Cloudflare R2",
    "handler": "lib/provider.ts",
    "module": "cloudflare-r2"
  }
];
