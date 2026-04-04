"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { useTheme } from "@/core/providers/theme-provider";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { ModuleWidgets, WidgetComponentRegistry, ModuleHomepageSections, HomepageSectionRegistry } from "@/core/generated/module-registry";

export default function HomePage() {
  const commonT = useTranslations('common');
  const modules = useAllModules();
  const { settings } = useSiteSettings();
  const { activeTheme } = useTheme();

  // Get enabled widgets from registry
  const widgetVisibility = (settings.widget_visibility || {}) as Record<string, boolean>;
  const enabledWidgets = ModuleWidgets
    .filter(w => modules[w.module] === true)
    .filter(w => widgetVisibility[w.id] !== false)
    .filter(w => WidgetComponentRegistry[w.id]);

  // Get enabled homepage sections from registry
  const enabledSections = ModuleHomepageSections
    .filter(s => modules[s.module] === true)
    .filter(s => HomepageSectionRegistry[s.id]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
      <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
        </div>

        {(() => {
          const SidebarLayout = activeTheme?.components?.SidebarLayout || StandardSidebarLayout;

          // Main content: render all enabled homepage sections from modules
          const mainContent = enabledSections.length > 0 ? (
            <div className="space-y-8">
              {enabledSections.map((section) => {
                const SectionComponent = HomepageSectionRegistry[section.id];
                return <SectionComponent key={section.id} />;
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">{commonT('home')}</p>
            </div>
          );

          // Sidebar: render widgets dynamically from registry
          const sidebarContent = enabledWidgets.length > 0 ? (
            <div className="space-y-5">
              {enabledWidgets.map((w) => {
                const WidgetComponent = WidgetComponentRegistry[w.id];
                return <WidgetComponent key={w.id} />;
              })}
            </div>
          ) : null;

          return sidebarContent ? (
            <SidebarLayout sidebar={sidebarContent}>{mainContent}</SidebarLayout>
          ) : (
            mainContent
          );
        })()}
      </main>

      <ThemeSlot name="Footer" defaultComponent={<Footer />} />
    </div>
  );
}
