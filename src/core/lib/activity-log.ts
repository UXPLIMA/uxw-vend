import { prisma } from "./db";
import { Prisma } from "@prisma/client";

/**
 * Record a single audit event. The schema stores `metadata` as a Json
 * column — previous versions cast the object to string which round-tripped
 * as a stringified blob rather than a queryable JSON document, making
 * downstream `prisma.activityLog.findMany({ where: { metadata: { path: [...], ... } } })`
 * queries fail silently. Now the object is handed to Prisma directly so
 * Prisma serializes it correctly.
 */
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
                metadata: params.metadata
                    ? (params.metadata as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                ipAddress: params.ipAddress || null,
            },
        });
    } catch (err) {
        console.error("[Activity Log] Failed:", err);
    }
}
