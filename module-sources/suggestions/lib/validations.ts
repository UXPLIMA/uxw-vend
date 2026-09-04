import { z } from "zod";

/**
 * Editing one suggestion. The route splits these by role - an admin moves
 * the status, the author rewrites the text - so all three are optional here
 * and the route still decides who may set which. `status` used to reach the
 * row untyped, which could leave a suggestion in a state the board filters
 * do not offer and nothing renders.
 */
export const SUGGESTION_STATUSES = ["open", "planned", "completed", "declined"] as const;

export const suggestionUpdateSchema = z.object({
    status: z.enum(SUGGESTION_STATUSES).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10_000).optional(),
});
