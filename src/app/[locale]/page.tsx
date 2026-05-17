"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useAllModules } from "@/core/providers/module-provider";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { ModuleWidgets, WidgetComponentRegistry, ModuleHomepageSections, HomepageSectionRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Sparkles, Settings, Puzzle } from "lucide-react";

export default function HomePage() {
  const commonT = useTranslations('common');
  const { data: session } = useSession();
  const modules = useAllModules();
  const { settings } = useSiteSettings();
  const isStaff = (session?.user?.rolePriority ?? 0) >= 50;

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
            <Card className="border-dashed">
              <CardContent className="py-14 px-6 text-center max-w-2xl mx-auto">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {commonT('welcomeTitle')}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {commonT('welcomeDescription')}
                </p>
                {isStaff ? (
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Link href="/admin/modules">
                      <Button>
                        <Puzzle className="w-4 h-4 mr-2" />
                        {commonT('welcomeBrowseModules')}
                      </Button>
                    </Link>
                    <Link href="/admin/settings">
                      <Button variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        {commonT('welcomeOpenSettings')}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {commonT('welcomeVisitorHint')}
                  </p>
                )}
              </CardContent>
            </Card>
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
