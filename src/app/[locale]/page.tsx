"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { ModuleWidgets, WidgetComponentRegistry, ModuleHomepageSections, HomepageSectionRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

export default function HomePage() {
  const commonT = useTranslations('common');
  const modules = useAllModules();
  const { settings } = useSiteSettings();

  const widgetVisibility = (settings.widget_visibility || {}) as Record<string, boolean>;
  const enabledWidgets = ModuleWidgets
    .filter(w => modules[w.module] === true)
    .filter(w => widgetVisibility[w.id] !== false)
    .filter(w => WidgetComponentRegistry[w.id]);

  const enabledSections = ModuleHomepageSections
    .filter(s => modules[s.module] === true)
    .filter(s => HomepageSectionRegistry[s.id]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ThemeComponentSlot name="Hero" />
      <Navbar />

      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
        </div>

        {(() => {
          const SidebarLayout = StandardSidebarLayout;

          const mainContent = enabledSections.length > 0 ? (
            <div className="space-y-8">
              {enabledSections.map((section) => {
                const SectionComponent = HomepageSectionRegistry[section.id];
                return (
                    <ModuleErrorBoundary key={section.id} fallbackLabel={`Failed to load ${section.id}`}>
                        <SectionComponent />
                    </ModuleErrorBoundary>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{commonT('home')}</p>
            </div>
          );

          const sidebarContent = enabledWidgets.length > 0 ? (
            <div className="space-y-5">
              {enabledWidgets.map((w) => {
                const WidgetComponent = WidgetComponentRegistry[w.id];
                return (
                    <ModuleErrorBoundary key={w.id} fallbackLabel={`Failed to load ${w.id}`}>
                        <WidgetComponent />
                    </ModuleErrorBoundary>
                );
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

      <Footer />
    </div>
  );
}
