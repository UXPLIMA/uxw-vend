import { z } from "zod";
import { SUGGESTION_STATUSES } from "./statuses";

/**
 * Editing one suggestion. The route splits these by role - an admin moves
 * the status, the author rewrites the text - so all three are optional here
 * and the route still decides who may set which. `status` used to reach the
 * row untyped, which could leave a suggestion in a state the board filters
 * do not offer and nothing renders.
 *
 * The statuses come from the board's own vocabulary rather than a second copy
 * of it: this list was two short of the dropdown an admin was offered, so two
 * of the six choices answered 400.
 */

export const suggestionUpdateSchema = z.object({
    status: z.enum(SUGGESTION_STATUSES).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10_000).optional(),
});

/**
 * A reply on the board. The ceiling is deliberate: the column is `@db.Text`,
 * so without one a single reply is the module's cheapest route to a megabyte
 * of stored HTML per submission.
 */
export const suggestionCommentSchema = z.object({
    content: z.string().trim().min(2, "Write something first").max(4_000),
});
