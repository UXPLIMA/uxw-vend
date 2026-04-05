// Auto-generated server-safe module data - no dynamic imports
export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = [
  {
    "path": "/announcements",
    "key": "announcements:api:/announcements",
    "module": "announcements",
    "method": "ALL"
  },
  {
    "path": "/blog/articles",
    "key": "blog:api:/blog/articles",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/articles/[id]",
    "key": "blog:api:/blog/articles/[id]",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/categories",
    "key": "blog:api:/blog/categories",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/categories/[id]",
    "key": "blog:api:/blog/categories/[id]",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/comments",
    "key": "blog:api:/blog/comments",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/comments/[id]",
    "key": "blog:api:/blog/comments/[id]",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/stats",
    "key": "blog:api:/blog/stats",
    "module": "blog",
    "method": "ALL"
  }
];

export const ModuleRoutesList: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
  {
    "path": "/admin/settings/analytics",
    "key": "analytics:pages/admin/settings/analytics/page.tsx",
    "module": "analytics",
    "isAdmin": true
  },
  {
    "path": "/admin/announcements",
    "key": "announcements:pages/admin/page.tsx",
    "module": "announcements",
    "isAdmin": true
  },
  {
    "path": "/blog",
    "key": "blog:pages/page.tsx",
    "module": "blog"
  },
  {
    "path": "/blog/[...params]",
    "key": "blog:pages/[...params]/page.tsx",
    "module": "blog"
  },
  {
    "path": "/admin/blog/articles",
    "key": "blog:pages/admin/articles/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/admin/blog/articles/new",
    "key": "blog:pages/admin/articles/new/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/admin/blog/articles/[id]/edit",
    "key": "blog:pages/admin/articles/[id]/edit/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/admin/blog/categories",
    "key": "blog:pages/admin/categories/page.tsx",
    "module": "blog",
    "isAdmin": true
  }
];
