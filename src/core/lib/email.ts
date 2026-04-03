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

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Password reset for ${email}: ${resetUrl}`);
        return;
    }

    await getResend()!.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Reset your ${APP_NAME} password`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">Reset Your Password</h2>
                <p style="color: #6b7280;">You requested a password reset for your ${APP_NAME} account.</p>
                <p style="color: #6b7280;">Click the button below to set a new password. This link expires in 1 hour.</p>
                <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
                    Reset Password
                </a>
                <p style="color: #9ca3af; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
            </div>
        `,
    });
}

export async function sendWelcomeEmail(email: string, username: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Welcome email for ${username} (${email})`);
        return;
    }

    await getResend()!.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Welcome to ${APP_NAME}!`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">Welcome, ${username}!</h2>
                <p style="color: #6b7280;">Your ${APP_NAME} account has been created successfully.</p>
                <p style="color: #6b7280;">You can now browse the store, join forum discussions, and manage your account.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
            </div>
        `,
    });
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
