/* eslint-disable */
import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
  'analytics:pages/admin/settings/analytics/page.tsx': dynamic(() => import('@/modules/analytics/pages/admin/settings/analytics/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
};

export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
  {
    "path": "/admin/settings/analytics",
    "key": "analytics:pages/admin/settings/analytics/page.tsx",
    "module": "analytics",
    "isAdmin": true
  }
];

export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = [];

export const ModuleApiRegistry: Record<string, () => Promise<any>> = {
};



// Widget component registry
export const WidgetComponentRegistry: Record<string, any> = {
};

// Homepage section component registry
export const HomepageSectionRegistry: Record<string, any> = {
};

export const ModuleHomepageSections: { id: string; type: string; component: string; order: number; module: string }[] = [];

// Layout component registry (rendered on every page)
export const LayoutComponentRegistry: Record<string, any> = {
  'GoogleAnalytics': dynamic(() => import('@/modules/analytics/components/GoogleAnalytics').then((mod: any) => mod.GoogleAnalytics || mod.default || mod), { loading: () => null }),
};

export const ModuleLayoutComponents: { id: string; component: string; module: string }[] = [
  {
    "id": "GoogleAnalytics",
    "component": "components/GoogleAnalytics",
    "module": "analytics"
  }
];

// Navbar component registry (rendered in navbar right side)
export const NavbarComponentRegistry: Record<string, any> = {
};

export const ModuleNavbarComponents: { id: string; component: string; order: number; module: string }[] = [];

export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = [];

export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = [];

export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = [];

export const ModuleDashboardCards: { id: string; label: string; icon: string; href: string; color: string; statKey: string; module: string }[] = [];

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
