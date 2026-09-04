import { z } from "zod";

/**
 * A form's field list, and what a visitor may submit against it.
 *
 * Both used to reach Prisma untouched. `fields` is a Json column, so any
 * shape at all was storable, including one the public renderer cannot read -
 * a form saved with a non-array `fields` renders as a blank page with no
 * error. And a submission's `data` was accepted as literally anything that
 * was not falsy: a 900 KB string, a nested object, an array.
 */
const FIELD_TYPES = ["text", "email", "number", "textarea", "select", "checkbox"] as const;

export const formFieldSchema = z.object({
    name: z.string().min(1).max(64),
    type: z.enum(FIELD_TYPES),
    label: z.string().min(1).max(200),
    required: z.boolean(),
    placeholder: z.string().max(200).optional(),
    options: z.array(z.string().max(200)).max(100).optional(),
}).strict();

export const formCreateSchema = z.object({
    title: z.string().trim().min(1, "Title and fields required").max(200),
    description: z.string().max(1_000).optional().nullable(),
    fields: z.array(formFieldSchema).min(1, "Title and fields required").max(100),
});

export const formUpdateSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(1_000).optional().nullable(),
    fields: z.array(formFieldSchema).min(1).max(100).optional(),
    isActive: z.boolean().optional(),
});

/**
 * A submission answers each field by name. The renderer only ever produces
 * strings (a checkbox becomes "true"/"false"), so that is what is accepted;
 * the ceilings are per-answer rather than only on the whole body, so one
 * field cannot carry the entire 1 MiB the body cap allows.
 */
export const formSubmissionSchema = z.object({
    data: z.record(z.string().max(64), z.string().max(10_000)),
});
