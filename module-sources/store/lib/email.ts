import { Resend } from "resend";

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@uxwvend.com";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "uxwVend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
    if (!process.env.RESEND_API_KEY) return null;
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
    return _resend;
}

function getEmailEnabled(): boolean {
    return !!process.env.RESEND_API_KEY;
}

export async function sendOrderConfirmationEmail(email: string, orderNumber: string, total: number) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Order confirmation for ${email}: ${orderNumber}`);
        return;
    }

    await getResend()!.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Order Confirmation - ${orderNumber}`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">Order Confirmed!</h2>
                <p style="color: #6b7280;">Thank you for your purchase. Your order <strong>${orderNumber}</strong> has been received.</p>
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; color: #1f2937;"><strong>Order:</strong> ${orderNumber}</p>
                    <p style="margin: 4px 0 0; color: #1f2937;"><strong>Total:</strong> $${total.toFixed(2)}</p>
                </div>
                <p style="color: #6b7280;">You can view your order details in your profile.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
            </div>
        `,
    });
}
