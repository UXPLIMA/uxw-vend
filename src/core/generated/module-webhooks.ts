// Auto-generated inbound webhook receivers registry
// /api/v1/webhook/[provider] dispatches to the matching handler

export const ModuleWebhookReceivers: { provider: string; module: string; signatureHeader?: string; secretEnv?: string; loader: () => Promise<{ default: (request: Request) => Promise<{ status: number; body?: unknown }> }> }[] = [
];
