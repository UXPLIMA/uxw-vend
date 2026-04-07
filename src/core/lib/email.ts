const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@uxwvend.com";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "uxwVend";

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

let _resend: unknown = null;

async function getResend(): Promise<{ emails: { send: (opts: Record<string, unknown>) => Promise<unknown> } } | null> {
    if (!process.env.RESEND_API_KEY) return null;
    if (!_resend) {
        const { Resend } = await import("resend");
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend as { emails: { send: (opts: Record<string, unknown>) => Promise<unknown> } };
}

function getEmailEnabled(): boolean {
    return !!process.env.RESEND_API_KEY;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Password reset for ${email}: ${resetUrl}`);
        return;
    }

    const resend = await getResend();
    await resend!.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Reset your ${APP_NAME} password`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">Reset Your Password</h2>
                <p style="color: #6b7280;">You requested a password reset for your ${APP_NAME} account.</p>
                <p style="color: #6b7280;">Click the button below to set a new password. This link expires in 1 hour.</p>
                <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
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

    const resend = await getResend();
    await resend!.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Welcome to ${APP_NAME}!`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">Welcome, ${escapeHtml(username)}!</h2>
                <p style="color: #6b7280;">Your ${APP_NAME} account has been created successfully.</p>
                <p style="color: #6b7280;">Explore the platform and discover all available features.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
            </div>
        `,
    });
}

export async function sendVerificationEmail(email: string, verifyUrl: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Verification for ${email}: ${verifyUrl}`);
        return;
    }

    const resend = await getResend();
    await resend!.emails.send({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Verify your ${APP_NAME} email`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">Verify Your Email</h2>
                <p style="color: #6b7280;">Click the button below to verify your email address.</p>
                <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
                    Verify Email
                </a>
                <p style="color: #9ca3af; font-size: 14px;">If you didn't create an account, ignore this email.</p>
            </div>
        `,
    });
}
