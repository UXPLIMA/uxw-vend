import { prisma } from "./db";

export async function logActivity(params: {
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
}) {
    try {
        await prisma.activityLog.create({
            data: {
                userId: params.userId || null,
                action: params.action,
                entity: params.entity || null,
                entityId: params.entityId || null,
                metadata: (params.metadata as unknown as string) || undefined,
                ipAddress: params.ipAddress || null,
            },
        });
    } catch (err) {
        console.error("[Activity Log] Failed:", err);
    }
}
