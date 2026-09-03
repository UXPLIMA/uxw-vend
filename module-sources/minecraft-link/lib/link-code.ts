/**
 * Proving that the person on the website is the person in the game.
 *
 * The trick needs no server plugin. The site whispers a short code to the
 * named player over RCON - a private in-game message only that account can
 * read, and only while it is online - and the player types it back on the
 * site. Possession of the code is the proof.
 *
 * What that buys, and what it does not: it proves whoever is at the keyboard
 * could read that account's private messages at that moment. It does not
 * survive someone standing behind them, which is why the code lasts minutes
 * rather than hours.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

/**
 * Six characters from an alphabet with no 0/O or 1/I/L, because the player is
 * reading this out of a chat line and typing it into a browser.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Long enough to alt-tab, short enough that a shoulder-surfed code goes stale. */
export const CODE_TTL_MS = 5 * 60 * 1000;

/** 31^6 is about 887 million, so this is generous rather than load-bearing. */
export const MAX_ATTEMPTS = 5;

export function generateCode(): string {
    // rejection-free: 248 is the largest multiple of 31 below 256, so any byte
    // at or above it is redrawn rather than folded, which would bias the
    // first few letters of the alphabet.
    const out: string[] = [];
    while (out.length < CODE_LENGTH) {
        for (const byte of crypto.randomBytes(CODE_LENGTH)) {
            if (byte >= 248) continue;
            out.push(ALPHABET[byte % ALPHABET.length]);
            if (out.length === CODE_LENGTH) break;
        }
    }
    return out.join("");
}

export function hashCode(code: string): string {
    return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/**
 * Replaces any code this user already has outstanding.
 *
 * One live code per user: otherwise asking for a new code would leave the old
 * one usable, and every request would widen the window instead of restarting it.
 */
export async function issueCode(params: {
    userId: string;
    username: string;
    serverId?: string | null;
}): Promise<string> {
    const code = generateCode();
    await prisma.minecraftLinkCode.deleteMany({ where: { userId: params.userId } });
    await prisma.minecraftLinkCode.create({
        data: {
            userId: params.userId,
            username: params.username,
            codeHash: hashCode(code),
            serverId: params.serverId ?? null,
            expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
    });
    await prisma.minecraftLinkCode
        .deleteMany({ where: { expiresAt: { lt: new Date() } } })
        .catch(() => undefined);
    return code;
}

export type RedeemFailure = "not-found" | "expired" | "too-many-attempts" | "wrong-user";

export type RedeemResult =
    | { ok: true; username: string }
    | { ok: false; reason: RedeemFailure; attemptsLeft?: number };

/**
 * Trades a code for the name it was whispered to.
 *
 * A wrong code is counted against the user's outstanding request rather than
 * looked up blindly, so guessing burns the attempt budget of the guesser's own
 * pending link instead of somebody else's.
 */
export async function redeemCode(userId: string, code: string): Promise<RedeemResult> {
    const pending = await prisma.minecraftLinkCode.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
    });
    if (!pending) return { ok: false, reason: "not-found" };

    if (pending.expiresAt.getTime() < Date.now()) {
        await prisma.minecraftLinkCode.delete({ where: { id: pending.id } }).catch(() => undefined);
        return { ok: false, reason: "expired" };
    }

    if (pending.codeHash !== hashCode(code)) {
        const attempts = pending.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
            await prisma.minecraftLinkCode.delete({ where: { id: pending.id } }).catch(() => undefined);
            return { ok: false, reason: "too-many-attempts" };
        }
        await prisma.minecraftLinkCode.update({ where: { id: pending.id }, data: { attempts } });
        return { ok: false, reason: "not-found", attemptsLeft: MAX_ATTEMPTS - attempts };
    }

    await prisma.minecraftLinkCode.delete({ where: { id: pending.id } }).catch(() => undefined);
    return { ok: true, username: pending.username };
}
