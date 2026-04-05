// Auto-generated server-safe module data - no dynamic imports
export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = [
  {
    "path": "/announcements",
    "key": "announcements:api:/announcements",
    "module": "announcements",
    "method": "ALL"
  },
  {
    "path": "/announcements/[id]",
    "key": "announcements:api:/announcements/[id]",
    "module": "announcements",
    "method": "ALL"
  }
];

export const ModuleRoutesList: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
  {
    "path": "/admin/analytics",
    "key": "analytics:pages/admin/settings/analytics/page.tsx",
    "module": "analytics",
    "isAdmin": true
  },
  {
    "path": "/admin/announcements",
    "key": "announcements:pages/admin/page.tsx",
    "module": "announcements",
    "isAdmin": true
  }
];
