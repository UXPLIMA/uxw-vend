import { z } from "zod";

/**
 * The shapes this module accepts on the wire.
 *
 * Every route here already hand-checked types with `typeof` and coerced
 * numbers with `Number(...)`, so what these add is the ceiling: a `note` or a
 * `prefix` had no declared length, and `expiresAt` reached `new Date(...)` as
 * whatever JSON carried, which Prisma answers with a 500 rather than a 400.
 * Where the old code coerced, these coerce too, so a client sending "5" for a
 * count keeps working.
 */

/** Public: what the customer's software sends to claim or check a seat. */
export const activateSchema = z.object({
    key: z.string().trim().min(1).max(200),
    machineId: z.string().trim().min(1).max(200),
    label: z.string().max(100).optional().nullable(),
});

export const releaseSchema = z.object({
    key: z.string().trim().min(1).max(200),
    machineId: z.string().trim().min(1).max(200),
});

export const validateSchema = z.object({
    key: z.string().trim().min(1).max(200),
});

/** Admin: minting a batch by hand. */
export const issueSchema = z.object({
    count: z.coerce.number().int().min(1).max(500).optional(),
    productId: z.string().max(64).optional().nullable(),
    productName: z.string().max(200).optional().nullable(),
    userId: z.string().max(64).optional().nullable(),
    maxActivations: z.coerce.number().int().min(1).max(10_000).optional(),
    validDays: z.coerce.number().int().min(1).max(36_500).optional().nullable(),
    prefix: z.string().max(32).optional().nullable(),
    note: z.string().max(1_000).optional().nullable(),
});

/** Admin: revoking, restoring, or re-dating one key. */
export const licensePatchSchema = z.object({
    status: z.enum(["active", "revoked"]).optional(),
    note: z.string().max(1_000).optional().nullable(),
    maxActivations: z.coerce.number().int().min(1).max(10_000).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional().nullable(),
});

/** Admin: which product mints keys, and what they are worth. */
export const licenseProductSchema = z.object({
    productId: z.string().trim().min(1, "productId required").max(64),
    keysPerUnit: z.coerce.number().int().min(1).max(1_000).optional(),
    maxActivations: z.coerce.number().int().min(1).max(10_000).optional(),
    validDays: z.coerce.number().int().min(1).max(36_500).optional().nullable(),
    prefix: z.string().max(32).optional().nullable(),
});

export const licenseProductPatchSchema = licenseProductSchema.partial();
