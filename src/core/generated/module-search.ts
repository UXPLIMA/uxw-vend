// Auto-generated public search providers registry
// Each entry points to a module file exporting a default async fn:
//   (query: string) => Promise<SearchResult[]>

export const ModuleSearchProviders: { id: string; label: string; module: string; loader: () => Promise<{ default: (query: string) => Promise<unknown[]> }> }[] = [
  { id: "blog-search", label: "Blog", module: "blog", loader: () => import('@/modules/blog/search/handler') as Promise<{ default: (query: string) => Promise<unknown[]> }> },
  { id: "forum-search", label: "Forum", module: "forum", loader: () => import('@/modules/forum/search/handler') as Promise<{ default: (query: string) => Promise<unknown[]> }> },
  { id: "help-center-search", label: "Help Center", module: "help-center", loader: () => import('@/modules/help-center/search/handler') as Promise<{ default: (query: string) => Promise<unknown[]> }> },
  { id: "store-search", label: "Store", module: "store", loader: () => import('@/modules/store/search/handler') as Promise<{ default: (query: string) => Promise<unknown[]> }> },
];
