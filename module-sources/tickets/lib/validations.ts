import { z } from "zod";

// ==================== TICKET SCHEMAS ====================

export const ticketDepartmentSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional().nullable(),
    color: z.string().max(32).optional().nullable(),
    order: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
});

/** The PATCH form: every field optional. */
export const ticketDepartmentUpdateSchema = ticketDepartmentSchema.partial();

export const ticketSchema = z.object({
    subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
    departmentId: z.string().min(1, "Department is required"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    message: z.string().min(10, "Message must be at least 10 characters").max(20_000),
});

export const ticketMessageSchema = z.object({
    content: z.string().min(1, "Message is required").max(20_000),
    ticketId: z.string().min(1),
    attachments: z.array(z.string().url()).optional(),
});

/**
 * The TicketStatus enum, once. The list is what the write schema accepts and
 * what the list endpoint's `?status=` filter accepts, so the two cannot drift:
 * a status the API will not set is not one it will search for either.
 */
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"] as const;

export const ticketUpdateSchema = z.object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedToId: z.string().optional().nullable(),
});

// Type exports
export type TicketInput = z.infer<typeof ticketSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
