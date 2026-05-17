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

// Inline localized strings for transactional emails. Each entry has en + tr.
// Other locales fall back to en. Kept here so emails don't depend on the
// next-intl request context (they're often sent from background jobs).
type EmailKey =
    | "resetSubject" | "resetHeading" | "resetIntro" | "resetCta" | "resetButton" | "resetIgnore"
    | "welcomeSubject" | "welcomeHeading" | "welcomeBody1" | "welcomeBody2"
    | "verifySubject" | "verifyHeading" | "verifyBody" | "verifyButton" | "verifyIgnore"
    | "lockoutSubject" | "lockoutHeading" | "lockoutHi" | "lockoutIntro" | "lockoutUnlocks"
    | "lockoutWasYou" | "lockoutNotYou" | "lockoutFooter" | "lockoutIpLine";

const EMAIL_STRINGS: Record<"en" | "tr", Record<EmailKey, string>> = {
    en: {
        resetSubject: "Reset your {app} password",
        resetHeading: "Reset Your Password",
        resetIntro: "You requested a password reset for your {app} account.",
        resetCta: "Click the button below to set a new password. This link expires in 1 hour.",
        resetButton: "Reset Password",
        resetIgnore: "If you didn't request this, you can safely ignore this email.",
        welcomeSubject: "Welcome to {app}!",
        welcomeHeading: "Welcome, {username}!",
        welcomeBody1: "Your {app} account has been created successfully.",
        welcomeBody2: "Explore the platform and discover all available features.",
        verifySubject: "Verify your {app} email",
        verifyHeading: "Verify Your Email",
        verifyBody: "Click the button below to verify your email address.",
        verifyButton: "Verify Email",
        verifyIgnore: "If you didn't create an account, ignore this email.",
        lockoutSubject: "{app}: too many failed sign-in attempts",
        lockoutHeading: "Unusual sign-in activity",
        lockoutHi: "Hi {username},",
        lockoutIntro: "Someone made too many failed sign-in attempts on your {app} account. We've temporarily locked it as a safety measure.",
        lockoutUnlocks: "The account unlocks at:",
        lockoutWasYou: "If this was you, wait until the lock lifts and try again.",
        lockoutNotYou: "If this was NOT you, change your password as soon as the account unlocks — someone knows (or is guessing) part of your credentials.",
        lockoutFooter: "{app} security notification.",
        lockoutIpLine: "Attempts came from IP",
    },
    tr: {
        resetSubject: "{app} şifreni sıfırla",
        resetHeading: "Şifreni Sıfırla",
        resetIntro: "{app} hesabın için şifre sıfırlama isteğinde bulundun.",
        resetCta: "Yeni bir şifre belirlemek için aşağıdaki butona tıkla. Bağlantı 1 saat içinde geçerliliğini yitirir.",
        resetButton: "Şifreyi Sıfırla",
        resetIgnore: "Eğer bu isteği sen yapmadıysan, bu e-postayı yok sayabilirsin.",
        welcomeSubject: "{app}'e hoş geldin!",
        welcomeHeading: "Hoş geldin, {username}!",
        welcomeBody1: "{app} hesabın başarıyla oluşturuldu.",
        welcomeBody2: "Platformu keşfet ve tüm özellikleri kullanmaya başla.",
        verifySubject: "{app} e-postanı doğrula",
        verifyHeading: "E-postanı Doğrula",
        verifyBody: "E-posta adresini doğrulamak için aşağıdaki butona tıkla.",
        verifyButton: "E-postayı Doğrula",
        verifyIgnore: "Eğer bir hesap oluşturmadıysan, bu e-postayı yok say.",
        lockoutSubject: "{app}: çok fazla başarısız giriş denemesi",
        lockoutHeading: "Olağandışı giriş etkinliği",
        lockoutHi: "Merhaba {username},",
        lockoutIntro: "{app} hesabında çok fazla başarısız giriş denemesi yapıldı. Güvenlik önlemi olarak hesabını geçici olarak kilitledik.",
        lockoutUnlocks: "Hesabın şu zamanda açılacak:",
        lockoutWasYou: "Bu sendin ise, kilit kalkana kadar bekleyip tekrar dene.",
        lockoutNotYou: "Bu SEN DEĞİLSEN, hesabın açılır açılmaz şifreni değiştir — biri kimlik bilgilerinin bir kısmını biliyor (veya tahmin ediyor).",
        lockoutFooter: "{app} güvenlik bildirimi.",
        lockoutIpLine: "Denemeler şu IP'den geldi:",
    },
};

function emailT(locale: string | undefined, key: EmailKey, vars: Record<string, string> = {}): string {
    const dict = locale === "tr" ? EMAIL_STRINGS.tr : EMAIL_STRINGS.en;
    let s = dict[key];
    s = s.replace(/\{app\}/g, APP_NAME);
    for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    return s;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Strip CR / LF / NUL from a value before it can reach an SMTP header.
 * Without this, a malicious `subject` field like "Hi\r\nBcc: me@example.com"
 * lets an attacker inject arbitrary recipients — the classic SMTP header
 * injection. The Resend SDK normalizes most of this, but we defend at the
 * edge so the invariant holds regardless of the provider in use.
 */
function stripHeaderInjection(value: string, maxLen = 998): string {
    if (typeof value !== "string") return "";
    return value
        // Any bare CR, LF, or NUL byte is rejected outright.
        .replace(/[\r\n\0]+/g, " ")
        // Long header fields may be folded by the provider in ways that
        // re-introduce control chars; clamp length to the RFC 5322 limit.
        .slice(0, maxLen)
        .trim();
}

function validateEmailAddress(addr: string): boolean {
    if (!addr || typeof addr !== "string") return false;
    if (/[\r\n\0,<>"]/.test(addr)) return false;
    if (addr.length > 254) return false;
    // Minimal shape check — provider does the heavy lifting.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
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
    // Refuse malformed/malicious recipient and subject fields BEFORE they
    // reach the provider so a user-derived value can't turn into an SMTP
    // header injection.
    if (!validateEmailAddress(opts.to)) {
        return { ok: false, error: "Invalid recipient address" };
    }
    const safeSubject = stripHeaderInjection(opts.subject);
    if (!safeSubject) {
        return { ok: false, error: "Empty subject after sanitization" };
    }

    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] To ${opts.to}: ${safeSubject}`);
        return { ok: true }; // Treat as delivered (dev/test mode)
    }
    const resend = await getResend();
    if (!resend) return { ok: false, error: "Resend client unavailable" };
    try {
        await resend.emails.send({
            from: `${stripHeaderInjection(APP_NAME)} <${stripHeaderInjection(FROM_EMAIL)}>`,
            to: opts.to,
            subject: safeSubject,
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

export async function sendPasswordResetEmail(email: string, resetUrl: string, locale?: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Password reset for ${email}: ${resetUrl}`);
        return;
    }

    await sendEmail({
        to: email,
        subject: emailT(locale, "resetSubject"),
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">${emailT(locale, "resetHeading")}</h2>
                <p style="color: #6b7280;">${emailT(locale, "resetIntro")}</p>
                <p style="color: #6b7280;">${emailT(locale, "resetCta")}</p>
                <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
                    ${emailT(locale, "resetButton")}
                </a>
                <p style="color: #9ca3af; font-size: 14px;">${emailT(locale, "resetIgnore")}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
            </div>
        `,
    });
}

export async function sendWelcomeEmail(email: string, username: string, locale?: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Welcome email for ${username} (${email})`);
        return;
    }

    // Welcome is non-urgent — queue it.
    await queueEmail({
        to: email,
        subject: emailT(locale, "welcomeSubject"),
        body: `${emailT(locale, "welcomeHeading", { username })} ${emailT(locale, "welcomeBody1")}`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">${emailT(locale, "welcomeHeading", { username: escapeHtml(username) })}</h2>
                <p style="color: #6b7280;">${emailT(locale, "welcomeBody1")}</p>
                <p style="color: #6b7280;">${emailT(locale, "welcomeBody2")}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
            </div>
        `,
    });
}

export async function sendVerificationEmail(email: string, verifyUrl: string, locale?: string) {
    if (!getEmailEnabled()) {
        console.log(`[Email Disabled] Verification for ${email}: ${verifyUrl}`);
        return;
    }

    await sendEmail({
        to: email,
        subject: emailT(locale, "verifySubject"),
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937;">${emailT(locale, "verifyHeading")}</h2>
                <p style="color: #6b7280;">${emailT(locale, "verifyBody")}</p>
                <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
                    ${emailT(locale, "verifyButton")}
                </a>
                <p style="color: #9ca3af; font-size: 14px;">${emailT(locale, "verifyIgnore")}</p>
            </div>
        `,
    });
}

/**
 * Sent when an account gets auto-locked after too many failed password
 * attempts. Gives the legitimate owner an early-warning signal that
 * someone is trying to sign in as them — critical for catching slow
 * credential-stuffing campaigns that don't trip IP rate limits.
 */
export async function sendAccountLockoutEmail(opts: {
    to: string;
    username: string;
    unlocksAt: Date;
    ip?: string;
    locale?: string;
}): Promise<void> {
    const unlocks = opts.unlocksAt.toUTCString();
    const ipLine = opts.ip
        ? `<p style="color: #6b7280;">${emailT(opts.locale, "lockoutIpLine")} <code>${escapeHtml(opts.ip)}</code>.</p>`
        : "";

    // Queue rather than send — this is informational. If the email system
    // is down, nothing is lost; the lock itself has already been armed.
    await queueEmail({
        to: opts.to,
        subject: emailT(opts.locale, "lockoutSubject"),
        body: emailT(opts.locale, "lockoutIntro") + " " + emailT(opts.locale, "lockoutUnlocks") + " " + unlocks,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #b91c1c;">${emailT(opts.locale, "lockoutHeading")}</h2>
                <p style="color: #374151;">${emailT(opts.locale, "lockoutHi", { username: escapeHtml(opts.username) })}</p>
                <p style="color: #6b7280;">${emailT(opts.locale, "lockoutIntro")}</p>
                <p style="color: #6b7280;"><strong>${emailT(opts.locale, "lockoutUnlocks")}</strong> ${escapeHtml(unlocks)}</p>
                ${ipLine}
                <p style="color: #6b7280;">${emailT(opts.locale, "lockoutWasYou")}</p>
                <p style="color: #6b7280;">${emailT(opts.locale, "lockoutNotYou")}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">${emailT(opts.locale, "lockoutFooter")}</p>
            </div>
        `,
    });
}
