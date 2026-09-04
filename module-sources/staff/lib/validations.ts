import { z } from "zod";

/** A staff member on the public team page. */
export const staffMemberSchema = z.object({
    name: z.string().trim().min(1, "Name and role required").max(100),
    role: z.string().trim().min(1, "Name and role required").max(100),
    avatar: z.string().max(2_000).optional().nullable(),
    userId: z.string().max(64).optional().nullable(),
    order: z.number().int().min(0).max(10_000).optional(),
});

/**
 * An application to join the team. `content` is what an applicant writes
 * about themselves and had no ceiling at all, which made this the module's
 * cheapest route to a megabyte of stored text per submission.
 */
export const staffApplicationSchema = z.object({
    position: z.string().trim().min(1, "Position and content required").max(100),
    content: z.string().trim().min(1, "Position and content required").max(10_000),
});

/**
 * What an admin does to one. The three values are the ones the review screen
 * sends; `status` reached the row untyped before, so an application could be
 * left in a state nothing renders.
 */
export const staffApplicationReviewSchema = z.object({
    status: z.enum(["pending", "accepted", "rejected"]).optional(),
    adminNote: z.string().max(2_000).optional().nullable(),
});
