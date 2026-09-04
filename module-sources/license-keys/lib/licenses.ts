/**
 * Issuing keys and answering the question the customer's software asks:
 * "is this key good, and may this machine use it?".
 */
import { prisma } from "@/core/sdk/server";
import { generateKey, hashKey, hashMachine, keyHint, sealKey, unsealKey } from "./key";

export interface IssueSpec {
    productId?: string | null;
    productName?: string | null;
    orderId?: string | null;
    userId?: string | null;
    maxActivations?: number;
    validDays?: number | null;
    prefix?: string | null;
    note?: string | null;
}

export interface IssuedKey {
    id: string;
    key: string;
    hint: string;
}

/** Mints one key. The plaintext is returned once and never read back this way again. */
export async function issueKey(spec: IssueSpec): Promise<IssuedKey> {
    const key = generateKey(spec.prefix);
    const row = await prisma.licenseKey.create({
        data: {
            keyHash: hashKey(key),
            keySealed: sealKey(key),
            keyHint: keyHint(key),
            productId: spec.productId ?? null,
            productName: spec.productName ?? null,
            orderId: spec.orderId ?? null,
            userId: spec.userId ?? null,
            maxActivations: Math.max(1, spec.maxActivations ?? 1),
            expiresAt:
                spec.validDays && spec.validDays > 0
                    ? new Date(Date.now() + spec.validDays * 24 * 60 * 60 * 1000)
                    : null,
            note: spec.note ?? null,
        },
    });
    return { id: row.id, key, hint: row.keyHint };
}

export async function issueKeys(count: number, spec: IssueSpec): Promise<IssuedKey[]> {
    const issued: IssuedKey[] = [];
    for (let i = 0; i < Math.max(0, count); i++) issued.push(await issueKey(spec));
    return issued;
}

/** Shows an owner their own key again. */
export function revealKey(sealed: string): string {
    return unsealKey(sealed);
}

export type LicenseRejection =
    | "unknown"
    | "revoked"
    | "expired"
    | "activation-limit";

export type ActivationResult =
    | {
          ok: true;
          productName: string | null;
          expiresAt: Date | null;
          activationsUsed: number;
          maxActivations: number;
          /** True when this call is what claimed the seat. */
          newActivation: boolean;
      }
    | { ok: false; reason: LicenseRejection };

interface CheckOptions {
    /** Claim a seat for this machine. Without it the key is only inspected. */
    machineId?: string | null;
    label?: string | null;
}

/**
 * Checks a key and, when a machine is named, claims a seat for it.
 *
 * A machine that already holds a seat is not charged a second one - software
 * calls this on every launch, and the customer would otherwise burn through
 * their activations by using the product.
 */
export async function checkLicense(key: string, options: CheckOptions = {}): Promise<ActivationResult> {
    const license = await prisma.licenseKey.findUnique({
        where: { keyHash: hashKey(key) },
        include: { activations: { select: { id: true, machineHash: true } } },
    });
    // A key that does not exist and a key that was never valid are the same
    // answer on purpose: this endpoint is public, and the difference would let
    // someone probe which keys are real.
    if (!license) return { ok: false, reason: "unknown" };
    if (license.status === "revoked") return { ok: false, reason: "revoked" };
    if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
        return { ok: false, reason: "expired" };
    }

    const summary = {
        productName: license.productName,
        expiresAt: license.expiresAt,
        maxActivations: license.maxActivations,
    };

    if (!options.machineId) {
        return {
            ok: true,
            ...summary,
            activationsUsed: license.activations.length,
            newActivation: false,
        };
    }

    const machineHash = hashMachine(options.machineId);
    const existing = license.activations.find((a) => a.machineHash === machineHash);

    if (existing) {
        await prisma.licenseActivation.update({
            where: { id: existing.id },
            data: { lastSeenAt: new Date() },
        });
        return {
            ok: true,
            ...summary,
            activationsUsed: license.activations.length,
            newActivation: false,
        };
    }

    if (license.activations.length >= license.maxActivations) {
        return { ok: false, reason: "activation-limit" };
    }

    let created: { id: string };
    try {
        created = await prisma.licenseActivation.create({
            data: { licenseKeyId: license.id, machineHash, label: options.label ?? null },
            select: { id: true },
        });
    } catch {
        // Two launches at once on the same machine race for the same seat.
        // The unique index settles it; the loser is already activated.
        return {
            ok: true,
            ...summary,
            activationsUsed: license.activations.length,
            newActivation: false,
        };
    }

    // The seat count read above was a snapshot, and the unique index only
    // covers two launches of the *same* machine. Two different machines
    // activating a one-seat key together both saw a free seat and both got a
    // row. Settle it after the fact and deterministically: the oldest
    // maxActivations rows keep their seats, so exactly that many machines win
    // and the rest are rolled back.
    const seats = await prisma.licenseActivation.findMany({
        where: { licenseKeyId: license.id },
        orderBy: [{ activatedAt: "asc" }, { id: "asc" }],
        take: license.maxActivations,
        select: { id: true },
    });
    if (!seats.some((seat) => seat.id === created.id)) {
        await prisma.licenseActivation.delete({ where: { id: created.id } }).catch(() => {});
        return { ok: false, reason: "activation-limit" };
    }

    return {
        ok: true,
        ...summary,
        activationsUsed: seats.length,
        newActivation: true,
    };
}

/** Frees a seat so the customer can move the product to another machine. */
export async function releaseActivation(key: string, machineId: string): Promise<boolean> {
    const license = await prisma.licenseKey.findUnique({ where: { keyHash: hashKey(key) } });
    if (!license) return false;
    const deleted = await prisma.licenseActivation.deleteMany({
        where: { licenseKeyId: license.id, machineHash: hashMachine(machineId) },
    });
    return deleted.count > 0;
}
