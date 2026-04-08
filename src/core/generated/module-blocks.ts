// Auto-generated page-builder blocks registry
// Each entry points to a module file exporting a Puck ComponentConfig
// as its default export.

export const ModulePageBlocks: { id: string; category?: string; component: string; module: string; loader: () => Promise<{ default: unknown }> }[] = [
  { id: "AnnouncementBanner", category: "Announcements", component: "blocks/AnnouncementBanner.tsx", module: "announcements", loader: () => import('@/modules/announcements/blocks/AnnouncementBanner') },
  { id: "BlogLatestPosts", category: "Blog", component: "blocks/BlogLatestPosts.tsx", module: "blog", loader: () => import('@/modules/blog/blocks/BlogLatestPosts') },
  { id: "BlogCategoryGrid", category: "Blog", component: "blocks/BlogCategoryGrid.tsx", module: "blog", loader: () => import('@/modules/blog/blocks/BlogCategoryGrid') },
  { id: "ChangelogRecentEntries", category: "Changelog", component: "blocks/ChangelogRecentEntries.tsx", module: "changelog", loader: () => import('@/modules/changelog/blocks/ChangelogRecentEntries') },
  { id: "LeaderboardTop", category: "Leaderboard", component: "blocks/LeaderboardTop.tsx", module: "leaderboard", loader: () => import('@/modules/leaderboard/blocks/LeaderboardTop') },
  { id: "SliderHero", category: "Slider", component: "blocks/SliderHero.tsx", module: "slider", loader: () => import('@/modules/slider/blocks/SliderHero') },
];
