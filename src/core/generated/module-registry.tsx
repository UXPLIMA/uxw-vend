/* eslint-disable */
import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
  'analytics:pages/admin/settings/analytics/page.tsx': dynamic(() => import('@/modules/analytics/pages/admin/settings/analytics/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'announcements:pages/admin/page.tsx': dynamic(() => import('@/modules/announcements/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/page.tsx': dynamic(() => import('@/modules/blog/pages/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/[...params]/page.tsx': dynamic(() => import('@/modules/blog/pages/[...params]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/new/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/new/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/[id]/edit/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/[id]/edit/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/categories/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
};

export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
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

export const ModuleApiRegistry: Record<string, () => Promise<any>> = {
  'announcements:api:/announcements': () => import('@/modules/announcements/api/route'),
  'blog:api:/blog/articles': () => import('@/modules/blog/api/articles/route'),
  'blog:api:/blog/articles/[id]': () => import('@/modules/blog/api/articles/[id]/route'),
  'blog:api:/blog/categories': () => import('@/modules/blog/api/categories/route'),
  'blog:api:/blog/categories/[id]': () => import('@/modules/blog/api/categories/[id]/route'),
  'blog:api:/blog/comments': () => import('@/modules/blog/api/comments/route'),
  'blog:api:/blog/comments/[id]': () => import('@/modules/blog/api/comments/[id]/route'),
  'blog:api:/blog/stats': () => import('@/modules/blog/api/stats/route'),
};



// Widget component registry
export const WidgetComponentRegistry: Record<string, any> = {
};

// Homepage section component registry
export const HomepageSectionRegistry: Record<string, any> = {
  'BlogNewsSection': dynamic(() => import('@/modules/blog/components/BlogNewsSection').then((mod: any) => mod.BlogNewsSection || mod.default || mod), { loading: () => null }),
};

export const ModuleHomepageSections: { id: string; type: string; component: string; order: number; module: string }[] = [
  {
    "id": "BlogNewsSection",
    "type": "content",
    "component": "components/BlogNewsSection",
    "order": 10,
    "module": "blog"
  }
];

// Layout component registry (rendered on every page)
export const LayoutComponentRegistry: Record<string, any> = {
  'GoogleAnalytics': dynamic(() => import('@/modules/analytics/components/GoogleAnalytics').then((mod: any) => mod.GoogleAnalytics || mod.default || mod), { loading: () => null }),
  'AnnouncementBanner': dynamic(() => import('@/modules/announcements/components/AnnouncementBanner').then((mod: any) => mod.AnnouncementBanner || mod.default || mod), { loading: () => null }),
};

export const ModuleLayoutComponents: { id: string; component: string; module: string; include?: string[]; exclude?: string[] }[] = [
  {
    "id": "GoogleAnalytics",
    "component": "components/GoogleAnalytics",
    "module": "analytics"
  },
  {
    "id": "AnnouncementBanner",
    "component": "components/AnnouncementBanner",
    "exclude": [
      "/admin/*"
    ],
    "module": "announcements"
  }
];

// Navbar component registry (rendered in navbar right side)
export const NavbarComponentRegistry: Record<string, any> = {
};

export const ModuleNavbarComponents: { id: string; component: string; order: number; module: string }[] = [];

export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = [];

export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = [];

export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = [];

export const ModuleDashboardCards: { id: string; label: string; icon: string; href: string; color: string; statKey: string; module: string }[] = [
  {
    "id": "articles",
    "label": "Articles",
    "icon": "FileText",
    "href": "/admin/blog/articles",
    "color": "text-indigo-600",
    "statKey": "articles",
    "module": "blog"
  }
];

// Profile tab component registry
export const ProfileTabRegistry: Record<string, any> = {
};

export const ModuleProfileTabs: { id: string; label: string; component: string; order: number; module: string }[] = [];

export const ModuleOauthButtons: { id: string; provider: string; label: string; color: string; svgIcon: string; module: string }[] = [];

export const ModuleSettingsCards: { title: string; description: string; href: string; icon: string; color: string; module: string }[] = [
  {
    "title": "Analytics",
    "description": "Google Analytics tracking.",
    "href": "/analytics",
    "icon": "BarChart",
    "color": "text-green-500",
    "module": "analytics"
  }
];
