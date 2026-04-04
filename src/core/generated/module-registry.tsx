import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
};

export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [];

export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = [];

export const ModuleApiRegistry: Record<string, () => Promise<any>> = {
};



// Widget component registry
export const WidgetComponentRegistry: Record<string, any> = {
};

export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = [];

export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = [];

export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = [];

export const ModuleDashboardCards: { id: string; label: string; icon: string; href: string; color: string; statKey: string; module: string }[] = [];
