// Auto-generated hook listener registry — server only
// Imports each listener as a plain dynamic import so it can be registered
// into the core hooks runtime at initialization.

export const ModuleHookListeners: { hook: string; type: "action" | "filter"; module: string; priority?: number; loader: () => Promise<{ default: (...args: unknown[]) => unknown }> }[] = [
  { hook: "referral.referral.used", type: "action", module: "credits", priority: 10, loader: () => import('@/modules/credits/hooks/on-referral-used') as Promise<{ default: (...args: unknown[]) => unknown }> },
  { hook: "blog.article.created", type: "action", module: "discord-integration", priority: 10, loader: () => import('@/modules/discord-integration/listeners/blog-article-created') as Promise<{ default: (...args: unknown[]) => unknown }> },
  { hook: "user.registered", type: "action", module: "store", priority: 10, loader: () => import('@/modules/store/hooks/on-user-registered') as Promise<{ default: (...args: unknown[]) => unknown }> },
];
