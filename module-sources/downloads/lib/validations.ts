import { z } from "zod";

/**
 * A download entry. Every field here was written to the row untyped: a
 * `fileUrl` could be any string of any length, and `fileSize` reached an
 * `Int` column as whatever JSON carried.
 */
export const downloadCreateSchema = z.object({
    title: z.string().trim().min(1, "Title, fileName and fileUrl required").max(200),
    description: z.string().max(2_000).optional().nullable(),
    fileName: z.string().trim().min(1, "Title, fileName and fileUrl required").max(255),
    fileUrl: z.string().trim().min(1, "Title, fileName and fileUrl required").max(2_000),
    fileSize: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().nullable(),
});
