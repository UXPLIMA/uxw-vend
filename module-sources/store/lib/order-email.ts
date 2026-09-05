import { formatSiteCurrency, log, queueEmail } from "@/core/sdk/server";

/**
 * The buyer's order confirmation.
 *
 * This used to be a second Resend client of the module's own, built straight
 * from `process.env.RESEND_API_KEY`. That skipped four things core does for
 * every other message: the `EmailJob` queue and its retries, the
 * `email.subject` / `email.body` filters a module can listen on, the header
 * injection guard, and the admin's own `resend_api_key` / `email_from` rows.
 * It also wrote the total as `$12.00` whatever `default_currency` said, and
 * wrote it in English to every buyer.
 *
 * The strings are inline rather than read through next-intl because this runs
 * from a gateway webhook, which has no request locale to inherit; the buyer's
 * stored locale is the only thing that knows what language they read. Core's
 * own transactional emails are built the same way, for the same reason.
 */

interface OrderEmailStrings {
    subject: string;
    heading: string;
    intro: string;
    orderLabel: string;
    totalLabel: string;
    footer: string;
}

const STRINGS: Record<string, OrderEmailStrings> = {
    en: {
        subject: "Order confirmation",
        heading: "Order confirmed",
        intro: "Thank you for your purchase. We have received your order.",
        orderLabel: "Order",
        totalLabel: "Total",
        footer: "You can view your order details in your profile.",
    },
    tr: {
        subject: "Sipariş onayı",
        heading: "Siparişiniz onaylandı",
        intro: "Satın aldığınız için teşekkürler. Siparişinizi aldık.",
        orderLabel: "Sipariş",
        totalLabel: "Toplam",
        footer: "Sipariş ayrıntılarını profilinizden görebilirsiniz.",
    },
};

function stringsFor(locale: string | null | undefined): OrderEmailStrings {
    return STRINGS[(locale ?? "en").slice(0, 2)] ?? STRINGS.en;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export async function sendOrderConfirmationEmail(input: {
    to: string;
    orderNumber: string;
    total: number;
    locale?: string | null;
}): Promise<void> {
    const t = stringsFor(input.locale);
    const total = await formatSiteCurrency(input.total, input.locale ?? "en");
    const orderNumber = escapeHtml(input.orderNumber);
    const subject = `${t.subject} - ${input.orderNumber}`;

    const body = [
        t.heading,
        "",
        t.intro,
        `${t.orderLabel}: ${input.orderNumber}`,
        `${t.totalLabel}: ${total}`,
        "",
        t.footer,
    ].join("\n");

    const html = `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">${escapeHtml(t.heading)}</h2>
                <p style="color: #6b7280;">${escapeHtml(t.intro)}</p>
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; color: #1f2937;"><strong>${escapeHtml(t.orderLabel)}:</strong> ${orderNumber}</p>
                    <p style="margin: 4px 0 0; color: #1f2937;"><strong>${escapeHtml(t.totalLabel)}:</strong> ${escapeHtml(total)}</p>
                </div>
                <p style="color: #6b7280;">${escapeHtml(t.footer)}</p>
            </div>
        `;

    const id = await queueEmail({ to: input.to, subject, body, html });
    if (!id) {
        log.warn("[store] order confirmation could not be queued", { orderNumber: input.orderNumber });
    }
}
