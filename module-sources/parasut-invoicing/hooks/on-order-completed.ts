/**
 * A paid order becomes an invoice.
 *
 * The claim row goes in before the call, because this hook arrives more than
 * once in normal operation - a retried gateway callback, an operator marking
 * an order paid that a webhook was already settling - and a legal invoice
 * issued twice has to be cancelled by hand. `createMany` with `skipDuplicates`
 * against the unique key on the order is the claim: it either wrote the row
 * or somebody else already has it.
 *
 * An order that cannot be invoiced is recorded with the reason rather than
 * dropped. An operator installed this because they have to issue invoices, so
 * an order they cannot is the one thing they need to be shown.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { log, moduleSettings, prisma } from "@/core/sdk/server";
import { whatToDoWith } from "../lib/decide";
import { contactPayload, invoicePayload } from "../lib/invoice-payload";
import { createRecord, isConfigured, ProviderError, withProvider } from "../lib/client";

/**
 * The shop's tax rate, read where the store keeps it.
 *
 * Module settings, not a `Setting` row: the rate moved there when the
 * payments screen stopped owning it, and reading the old key would have put
 * zero percent on every invoice - a legally wrong document that looks fine.
 */
async function taxRate(): Promise<number> {
    const settings = await moduleSettings<{ taxRate?: number }>("store");
    const rate = Number(settings.taxRate);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

const onOrderCompleted: HookHandlerFor<"store.order.completed", "action"> = async (payload) => {
    if (!(await isConfigured())) return;

    const order = await prisma.order.findUnique({
        where: { id: payload.id },
        include: { items: true, user: { select: { email: true } } },
    });
    if (!order) return;

    const existing = await prisma.issuedInvoice.findUnique({ where: { orderId: order.id } });
    const decision = whatToDoWith(
        { id: order.id, status: order.status, billingDetails: order.billingDetails, total: order.total },
        existing ? { status: existing.status as "pending" | "issued" | "failed" } : null,
    );

    if ("skip" in decision) return;

    if ("hold" in decision) {
        await prisma.issuedInvoice.upsert({
            where: { orderId: order.id },
            create: { orderId: order.id, status: "failed", reason: "No invoice details on the order" },
            update: { status: "failed", reason: "No invoice details on the order" },
        });
        return;
    }

    // The claim. Racing completions both reach here; only one writes.
    const claimed = await prisma.issuedInvoice.createMany({
        data: [{ orderId: order.id, status: "pending" }],
        skipDuplicates: true,
    });
    if (claimed.count === 0) {
        // Somebody else holds it, unless the row is a previous failure this
        // run is retrying.
        const retry = await prisma.issuedInvoice.updateMany({
            where: { orderId: order.id, status: "failed" },
            data: { status: "pending", reason: null },
        });
        if (retry.count === 0) return;
    }

    try {
        const remote = await withProvider(async (config, token) => {
            const contact = await createRecord(
                config,
                token,
                "contacts",
                contactPayload(decision.billing, order.user?.email ?? ""),
            );
            return createRecord(
                config,
                token,
                "sales_invoices",
                invoicePayload({
                    contactId: contact.id,
                    order: {
                        orderNumber: order.orderNumber,
                        currency: order.currency,
                        taxRate: await taxRate(),
                        lines: order.items.map((item) => ({
                            name: item.name,
                            quantity: item.quantity,
                            unitAmount: Number(item.price),
                        })),
                    },
                    issuedOn: new Date(),
                }),
            );
        });

        await prisma.issuedInvoice.update({
            where: { orderId: order.id },
            data: {
                status: "issued",
                remoteId: remote.id,
                remoteNumber: typeof remote.attributes.invoice_no === "string" ? remote.attributes.invoice_no : null,
                issuedAt: new Date(),
                reason: null,
                attempts: { increment: 1 },
            },
        });
    } catch (err) {
        const reason = err instanceof ProviderError ? err.message : "The invoice could not be issued";
        // The order id, never the payload: it carries the buyer's address and
        // tax number.
        log.error("[parasut-invoicing] issuing an invoice failed", { orderId: order.id });
        await prisma.issuedInvoice.update({
            where: { orderId: order.id },
            data: { status: "failed", reason, attempts: { increment: 1 } },
        });
    }
};

export default onOrderCompleted;
