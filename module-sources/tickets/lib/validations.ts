import { z } from "zod";

// ==================== TICKET SCHEMAS ====================

export const ticketDepartmentSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    color: z.string().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

export const ticketSchema = z.object({
    subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
    departmentId: z.string().min(1, "Department is required"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    message: z.string().min(10, "Message must be at least 10 characters"),
});

export const ticketMessageSchema = z.object({
    content: z.string().min(1, "Message is required"),
    ticketId: z.string().min(1),
    attachments: z.array(z.string().url()).optional(),
});

export const ticketUpdateSchema = z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedToId: z.string().optional().nullable(),
});

// Type exports
export type TicketInput = z.infer<typeof ticketSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
