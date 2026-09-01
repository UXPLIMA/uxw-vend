/**
 * Admin-tunable auth settings.
 *
 * These live in `Setting` and are edited on Admin > Settings > General. Each
 * one is clamped here rather than at the form, because the form is not the only
 * writer — the settings API accepts any number, and a stored row survives a UI
 * change.
 *
 * The password minimum is deliberately one-directional: an admin can require
 * longer passwords than the built-in policy, never shorter. A control that
 * could silently weaken every password check is worse than no control.
 */

import { prisma } from "./db";
import { PASSWORD_POLICY, checkPasswordPolicy, type PasswordCheck } from "./password-policy";

export const SETTING_KEYS = {
    passwordMinLength: "password_min_length",
    passwordResetExpiryMinutes: "password_reset_expiry_minutes",
    emailVerifyExpiryHours: "email_verify_expiry_hours",
    settingsCacheSeconds: "settings_cache_seconds",
} as const;

export interface DurationSetting {
    key: string;
    /** Used when the row is missing or unusable. */
    defaultValue: number;
    min: number;
    max: number;
    /** Milliseconds per unit, for converting the stored value. */
    unitMs: number;
}

/** Minutes. One hour by default; anything under five is unusable in practice. */
export const PASSWORD_RESET_EXPIRY: DurationSetting = {
    key: SETTING_KEYS.passwordResetExpiryMinutes,
    defaultValue: 60,
    min: 5,
    max: 1440,
    unitMs: 60_000,
};

/** Hours. A day by default, capped at a week. */
export const EMAIL_VERIFY_EXPIRY: DurationSetting = {
    key: SETTING_KEYS.emailVerifyExpiryHours,
    defaultValue: 24,
    min: 1,
    max: 168,
    unitMs: 3_600_000,
};

/** Seconds the client may reuse a fetched settings payload. */
export const SETTINGS_CACHE: DurationSetting = {
    key: SETTING_KEYS.settingsCacheSeconds,
    defaultValue: 60,
    min: 5,
    max: 3600,
    unitMs: 1000,
};

function toNumber(raw: unknown): number | null {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (typeof raw === "string" && raw.trim()) {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function clampDuration(raw: unknown, setting: DurationSetting): number {
    const n = toNumber(raw);
    if (n === null) return setting.defaultValue;
    return Math.min(setting.max, Math.max(setting.min, Math.floor(n)));
}

export function clampMinPasswordLength(raw: unknown): number {
    const n = toNumber(raw);
    if (n === null) return PASSWORD_POLICY.MIN_LENGTH;
    return Math.min(PASSWORD_POLICY.MAX_LENGTH, Math.max(PASSWORD_POLICY.MIN_LENGTH, Math.floor(n)));
}

async function readSetting(key: string): Promise<unknown> {
    try {
        const row = await prisma.setting.findUnique({ where: { key } });
        return row?.value ?? null;
    } catch {
        // A settings read must never take down a sign-up or a reset.
        return null;
    }
}

export async function getPasswordMinLength(): Promise<number> {
    return clampMinPasswordLength(await readSetting(SETTING_KEYS.passwordMinLength));
}

export async function getDurationMs(setting: DurationSetting): Promise<number> {
    return clampDuration(await readSetting(setting.key), setting) * setting.unitMs;
}

/**
 * Full password check: the built-in policy plus the admin's minimum length.
 * Every flow that accepts a new password goes through this.
 */
export async function enforcePasswordPolicy(password: unknown): Promise<PasswordCheck> {
    const base = checkPasswordPolicy(password);
    if (!base.ok) return base;

    const min = await getPasswordMinLength();
    if (typeof password === "string" && password.length < min) {
        return { ok: false, reason: "too_short", message: `Password must be at least ${min} characters` };
    }
    return { ok: true };
}
