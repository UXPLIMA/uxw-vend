"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { HeroBanner, Navbar, Footer, AnnouncementBanner } from "@/core/components/layout";
import { SkeletonNewsGrid, SkeletonSidebar } from "@/core/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { useTheme } from "@/core/providers/theme-provider";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { ModuleWidgets, WidgetComponentRegistry } from "@/core/generated/module-registry";

interface BlogPost {
  id: string;
  number: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  createdAt: string;
  category: { name: string; slug: string } | null;
}

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  const t = useTranslations('news');
  const commonT = useTranslations('common');
  const modules = useAllModules();
  const { settings } = useSiteSettings();
  const { activeTheme } = useTheme();

  // Check if any module provides a blog/news API
  const blogEnabled = modules['blog'] === true;

  // Fetch blog articles (only if blog module installed)
  useEffect(() => {
    if (!blogEnabled) { setIsLoading(false); return; }
    setIsLoading(true);
    fetch('/api/v1/blog/articles?limit=8')
      .then(res => res.json())
      .then(data => { setBlogPosts(data.articles || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [blogEnabled]);

  // Pagination
  const newsPerPage = Number(settings.per_page_home_news) || 4;
  const totalPages = Math.ceil(blogPosts.length / newsPerPage);
  const paginatedNews = blogPosts.slice((currentPage - 1) * newsPerPage, currentPage * newsPerPage);

  // Get enabled widgets from registry — no hardcoded widget names
  const widgetVisibility = (settings.widget_visibility || {}) as Record<string, boolean>;
  const enabledWidgets = ModuleWidgets
    .filter(w => modules[w.module] === true)         // module must be installed & enabled
    .filter(w => widgetVisibility[w.id] !== false)    // not hidden by admin
    .filter(w => WidgetComponentRegistry[w.id]);      // component exists in registry

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <AnnouncementBanner />
      <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
      <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
          {blogEnabled && (
            <>
              <span className="mx-2">/</span>
              <span className="text-gray-700">{t('title')}</span>
            </>
          )}
        </div>

        {(() => {
          const SidebarLayout = activeTheme?.components?.SidebarLayout || StandardSidebarLayout;

          // News content — only if blog module provides it
          const newsContent = blogEnabled ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('title')}</h2>
              {isLoading ? (
                <SkeletonNewsGrid count={4} />
              ) : blogPosts.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <p className="text-gray-500">{t('noPosts') || 'No posts yet.'}</p>
                </div>
              ) : (
                <>
                  {/* Render posts — use ThemeSlot for override, fallback to generic grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {paginatedNews.map((post) => (
                      <Link key={post.id} href={`/blog/${post.number}/${post.slug}`}
                        className="bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                        <div className="h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
                          {post.coverImage ? (
                            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="text-gray-300 text-sm">No image</div>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-xs text-gray-400 mb-1">
                            {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                          </p>
                          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{post.title}</h3>
                          {post.excerpt && <p className="text-sm text-gray-500 line-clamp-2">{post.excerpt}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button variant="outline" size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> {t('previous')}
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm"
                          onClick={() => setCurrentPage(page)}>
                          {page}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}>
                        {t('next')} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">{commonT('home')}</p>
            </div>
          );

          // Sidebar — render widgets dynamically from registry
          const sidebarContent = enabledWidgets.length > 0 ? (
            <div className="space-y-5">
              {enabledWidgets.map((w) => {
                const WidgetComponent = WidgetComponentRegistry[w.id];
                return <WidgetComponent key={w.id} />;
              })}
            </div>
          ) : null;

          return sidebarContent ? (
            <SidebarLayout sidebar={sidebarContent}>{newsContent}</SidebarLayout>
          ) : (
            newsContent
          );
        })()}
      </main>

      <ThemeSlot name="Footer" defaultComponent={<Footer />} />
    </div>
  );
}
