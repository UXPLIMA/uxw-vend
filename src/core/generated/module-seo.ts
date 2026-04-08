// Auto-generated module SEO sitemap registry — server only
// Each entry points to a module file exporting a default async fn:
//   () => Promise<SitemapEntry[]>

export interface SitemapEntry {
    url: string;
    lastModified?: Date;
    changeFreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}

export const ModuleSeoRoutes: { module: string; loader: () => Promise<{ default: () => Promise<SitemapEntry[]> }> }[] = [
  { module: "blog", loader: () => import('@/modules/blog/seo/sitemap') as Promise<{ default: () => Promise<SitemapEntry[]> }> },
  { module: "forum", loader: () => import('@/modules/forum/seo/sitemap') as Promise<{ default: () => Promise<SitemapEntry[]> }> },
  { module: "help-center", loader: () => import('@/modules/help-center/seo/sitemap') as Promise<{ default: () => Promise<SitemapEntry[]> }> },
];
