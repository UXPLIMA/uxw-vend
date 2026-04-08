import { prisma } from "./db";

/**
 * Core email service.
 *
 * Two modes of use:
 *
 *   1. queueEmail({...}) — enqueue an EmailJob row and return immediately.
 *      A core cron (`core:process-email-queue`) drains the queue every
 *      5 minutes with exponential backoff. Use this for anything that
 *      does NOT need to be delivered before the HTTP response returns
 *      (broadcasts, welcome mails, receipts, etc.).
 *
 *   2. sendEmail({...}) — still synchronous for callers that MUST send
 *      immediately (password reset links, 2FA, email verification).
 *      Internally this still logs an EmailJob row for audit purposes
 *      so every outbound message is recorded in one place.
 *
 * When no provider is configured (no RESEND_API_KEY) all functions
 * degrade gracefully to console.log — tests and dev don't need SMTP.
 */

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@uxwvend.com";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "uxwVend";
const MAX_ATTEMPTS = 3;

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Provider (Resend)
// ---------------------------------------------------------------------------

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

/**
 * Low-level provider call. Does NOT touch the EmailJob row — callers are
 * responsible for status bookkeeping. Returns true on success.
 */
async function deliverViaProvider(opts: {
    to: string;
    subject: string;
    html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] To ${opts.to}: ${opts.subject}`);
        return { ok: true }; // Treat as delivered (dev/test mode)
    }
    const resend = await getResend();
    if (!resend) return { ok: false, error: "Resend client unavailable" };
    try {
        await resend.emails.send({
            from: `${APP_NAME} <${FROM_EMAIL}>`,
            to: opts.to,
            subject: opts.subject,
            html: opts.html,
        });
        return { ok: true };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error("[email] delivery failed:", error);
        return { ok: false, error };
    }
}

// ---------------------------------------------------------------------------
// Queue API
// ---------------------------------------------------------------------------

export interface QueueEmailInput {
    to: string;
    subject: string;
    /** Plain-text body — stored in EmailJob.body for audit. */
    body: string;
    /** Optional HTML body. If omitted, `body` is rendered as-is. */
    html?: string;
    /** Delay delivery until this time. Defaults to "now". */
    scheduleFor?: Date;
}

/**
 * Enqueue an email for background delivery. Returns the EmailJob id
 * (or null if DB insert failed). Always non-blocking and non-throwing.
 */
export async function queueEmail(input: QueueEmailInput): Promise<string | null> {
    try {
        const job = await prisma.emailJob.create({
            data: {
                to: input.to,
                subject: input.subject,
                body: input.body,
                html: input.html ?? null,
                status: "pending",
                scheduledAt: input.scheduleFor ?? new Date(),
            },
        });
        return job.id;
    } catch (err) {
        console.error("[email] queueEmail failed:", err);
        return null;
    }
}

/**
 * Drain up to `batchSize` pending jobs whose scheduledAt <= now.
 * Each job is marked `sending` before delivery to avoid duplicate sends
 * if two workers race; on failure it either retries (attempts < 3)
 * with exponential backoff or is marked `failed`.
 *
 * Safe to call from a cron, an admin endpoint, or tests.
 */
export async function processEmailQueue(batchSize = 10): Promise<{
    processed: number;
    sent: number;
    failed: number;
    retried: number;
}> {
    const now = new Date();
    let sent = 0;
    let failed = 0;
    let retried = 0;

    // Claim a batch. We use updateMany → findMany to mark as "sending"
    // atomically-enough for our scale; for strict exactly-once a SELECT
    // FOR UPDATE / advisory-lock pattern would be stronger.
    const pending = await prisma.emailJob.findMany({
        where: { status: "pending", scheduledAt: { lte: now } },
        orderBy: { scheduledAt: "asc" },
        take: batchSize,
    });

    if (pending.length === 0) {
        return { processed: 0, sent: 0, failed: 0, retried: 0 };
    }

    const claimed = await prisma.emailJob.updateMany({
        where: {
            id: { in: pending.map((j) => j.id) },
            status: "pending",
        },
        data: { status: "sending" },
    });

    if (claimed.count === 0) {
        return { processed: 0, sent: 0, failed: 0, retried: 0 };
    }

    for (const job of pending) {
        const html = job.html ?? `<pre>${escapeHtml(job.body)}</pre>`;
        const result = await deliverViaProvider({
            to: job.to,
            subject: job.subject,
            html,
        });

        const attempts = job.attempts + 1;

        if (result.ok) {
            await prisma.emailJob.update({
                where: { id: job.id },
                data: {
                    status: "sent",
                    attempts,
                    sentAt: new Date(),
                    lastError: null,
                },
            });
            sent++;
            continue;
        }

        if (attempts >= MAX_ATTEMPTS) {
            await prisma.emailJob.update({
                where: { id: job.id },
                data: { status: "failed", attempts, lastError: result.error },
            });
            failed++;
            continue;
        }

        // Exponential backoff: 2^attempts minutes (2, 4, 8, ...)
        const backoffMs = Math.pow(2, attempts) * 60_000;
        await prisma.emailJob.update({
            where: { id: job.id },
            data: {
                status: "pending",
                attempts,
                lastError: result.error,
                scheduledAt: new Date(Date.now() + backoffMs),
            },
        });
        retried++;
    }

    return { processed: pending.length, sent, failed, retried };
}

// ---------------------------------------------------------------------------
// Synchronous send (legacy / must-send-now callers)
// ---------------------------------------------------------------------------

/**
 * Send an email right now (blocks the request). Use only for
 * authentication flows where the user is waiting on the message
 * (password reset, 2FA, email verification). Everything else should
 * use queueEmail().
 *
 * An EmailJob row is still written for audit.
 */
export async function sendEmail(opts: {
    to: string;
    subject: string;
    html: string;
}): Promise<boolean> {
    // Record an audit row regardless of provider state.
    let jobId: string | null = null;
    try {
        const job = await prisma.emailJob.create({
            data: {
                to: opts.to,
                subject: opts.subject,
                body: opts.html, // fallback text body
                html: opts.html,
                status: "sending",
                attempts: 1,
            },
        });
        jobId = job.id;
    } catch {
        // Audit row is best-effort — continue with the send.
    }

    const result = await deliverViaProvider(opts);

    if (jobId) {
        try {
            await prisma.emailJob.update({
                where: { id: jobId },
                data: result.ok
                    ? { status: "sent", sentAt: new Date(), lastError: null }
                    : { status: "failed", lastError: result.error },
            });
        } catch {
            /* swallow — audit failures shouldn't mask the real result */
        }
    }

    return result.ok;
}

// ---------------------------------------------------------------------------
// Pre-rendered auth emails (must-send-now)
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Password reset for ${email}: ${resetUrl}`);
        return;
    }

    await sendEmail({
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

    // Welcome is non-urgent — queue it.
    await queueEmail({
        to: email,
        subject: `Welcome to ${APP_NAME}!`,
        body: `Welcome, ${username}! Your ${APP_NAME} account has been created successfully.`,
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

    await sendEmail({
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
