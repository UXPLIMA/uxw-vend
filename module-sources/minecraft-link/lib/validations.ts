import { z } from "zod";

/**
 * What the link flow accepts. The username itself is checked against
 * `MINECRAFT_USERNAME` in the route, so this only bounds the length before
 * that regex runs and keeps `serverId` and `userId` from reaching a Prisma
 * `where` clause as something other than a string.
 */
export const linkRequestSchema = z.object({
    username: z.string().trim().max(64).optional(),
    serverId: z.string().max(64).optional().nullable(),
});

export const unlinkSchema = z.object({
    userId: z.string().max(64).optional().nullable(),
});

export const confirmSchema = z.object({
    code: z.string().trim().min(1, "code_required").max(64),
});
