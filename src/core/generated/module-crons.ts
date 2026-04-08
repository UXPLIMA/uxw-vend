// Auto-generated module cron jobs registry
// Each entry points to a module file exporting a default async function

export const ModuleCronJobs: { id: string; schedule: string; module: string; loader: () => Promise<{ default: () => Promise<void> }> }[] = [
  { id: "currency-rate-refresh", schedule: "every-hour", module: "currency", loader: () => import('@/modules/currency/cron/refresh') as Promise<{ default: () => Promise<void> }> },
  { id: "webhook-logs-cleanup", schedule: "every-day", module: "webhook-logs", loader: () => import('@/modules/webhook-logs/cron/cleanup') as Promise<{ default: () => Promise<void> }> },
];
