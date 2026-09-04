import { z } from "zod";

/**
 * What the bell menu sends when it marks notifications read.
 *
 * `id` used to reach a Prisma `where` clause untyped, where an object is a
 * filter operator rather than an id - `{"id":{"not":""}}` alongside the
 * caller's own `userId` marked that account's whole inbox read, which is
 * harmless here but is the same shape that is not harmless elsewhere.
 */
export const markReadSchema = z.object({
    id: z.string().min(1).max(64).optional(),
    markAllRead: z.boolean().optional(),
});
