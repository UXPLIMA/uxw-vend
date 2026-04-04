"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { HeroBanner, Navbar, Footer, AnnouncementBanner } from "@/core/components/layout";
import { SkeletonNewsGrid, SkeletonSidebar } from "@/core/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useModuleEnabled } from "@/core/hooks/useModule";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { NewsCard } from "@/core/components/cards/news-card";
import { DiscordWidget } from "@/core/components/widgets/discord-widget";
import { FeaturedProductWidget } from "@/core/components/widgets/featured-product-widget";
import { PaymentGoalWidget } from "@/core/components/widgets/payment-goal-widget";
import { TopCustomerWidget } from "@/core/components/widgets/top-customer-widget";
import { TopBuyersWidget } from "@/core/components/widgets/top-buyers-widget";
import { TopCreditLoadersWidget } from "@/core/components/widgets/top-credit-loaders-widget";
import { RecentPurchasesWidget } from "@/core/components/widgets/recent-purchases-widget";
import { NewsGrid } from "@/core/components/blog/news-grid";
import { SliderWidget } from "@/core/components/widgets/slider-widget";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";

// Blog post type from API
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
  const { enabled: blogEnabled } = useModuleEnabled('blog');
  const { settings } = useSiteSettings();

  // Widget visibility from admin settings
  const widgetVisibility = (settings.widget_visibility || {}) as Record<string, boolean>;
  const widgetOrder = (Array.isArray(settings.widget_order) ? settings.widget_order : [
      "DiscordWidget", "FeaturedProductWidget", "PaymentGoalWidget",
      "TopCustomerWidget", "TopBuyersWidget", "TopCreditLoadersWidget", "RecentPurchasesWidget"
  ]) as string[];
  const isWidgetVisible = (id: string) => widgetVisibility[id] !== false;

  // Fetch blog articles from API (only if blog module enabled)
  useEffect(() => {
    if (!blogEnabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch('/api/v1/blog/articles?limit=8')
      .then(res => res.json())
      .then(data => {
        setBlogPosts(data.articles || []);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [blogEnabled]);

  // Pagination
  const newsPerPage = 4;
  const totalPages = Math.ceil(blogPosts.length / newsPerPage);
  const paginatedNews = blogPosts.slice((currentPage - 1) * newsPerPage, currentPage * newsPerPage);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Announcements */}
      <AnnouncementBanner />

      {/* Shared Hero Banner */}
      <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />


      {/* Shared Navbar */}
      <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Slider */}
        <SliderWidget />

        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{t('title')}</span>
        </div>

        <ThemeSlot
          name="SidebarLayout"
          defaultComponent={<StandardSidebarLayout sidebar={null as any} children={null} />}
          props={{
            children: (
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t('title')}</h2>

                {/* 2-Column News Grid */}
                {isLoading ? (
                  <SkeletonNewsGrid count={4} />
                ) : blogPosts.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center">
                    <p className="text-gray-500">No blog posts yet.</p>
                  </div>
                ) : (
                  <ThemeSlot
                    name="NewsGrid"
                    defaultComponent={<NewsGrid posts={paginatedNews} />}
                    props={{ posts: paginatedNews }}
                  />
                )}

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="border-gray-300 text-gray-700 hover:text-gray-900"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> {t('previous')}
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? "bg-blue-600" : "border-gray-300"}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="border-gray-300 text-gray-700 hover:text-gray-900"
                  >
                    {t('next')} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ),
            sidebar: (
              <div className="space-y-5">
                {isLoading ? (
                  <SkeletonSidebar />
                ) : (
                  <>
                    {widgetOrder.map((id) => {
                      if (!isWidgetVisible(id)) return null;
                      const widgetMap: Record<string, React.ReactNode> = {
                        DiscordWidget: <ThemeSlot key={id} name="DiscordWidget" defaultComponent={<DiscordWidget />} />,
                        FeaturedProductWidget: <ThemeSlot key={id} name="FeaturedProductWidget" defaultComponent={<FeaturedProductWidget />} />,
                        PaymentGoalWidget: <ThemeSlot key={id} name="PaymentGoalWidget" defaultComponent={<PaymentGoalWidget />} />,
                        TopCustomerWidget: <ThemeSlot key={id} name="TopCustomerWidget" defaultComponent={<TopCustomerWidget />} />,
                        TopBuyersWidget: <ThemeSlot key={id} name="TopBuyersWidget" defaultComponent={<TopBuyersWidget />} />,
                        TopCreditLoadersWidget: <ThemeSlot key={id} name="TopCreditLoadersWidget" defaultComponent={<TopCreditLoadersWidget />} />,
                        RecentPurchasesWidget: <ThemeSlot key={id} name="RecentPurchasesWidget" defaultComponent={<RecentPurchasesWidget />} />,
                      };
                      return widgetMap[id] || null;
                    })}
                  </>
                )}
              </div>
            )
          }}
        />
      </main >

      {/* Shared Footer */}
      < ThemeSlot name="Footer" defaultComponent={< Footer />} />
    </div >
  );
}
