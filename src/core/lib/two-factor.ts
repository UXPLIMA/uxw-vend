import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { randomBytes, createHash } from "crypto";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "uxwVend";

export function generateSecret(email: string): { secret: string; uri: string } {
    const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: new OTPAuth.Secret({ size: 20 }),
    });

    return {
        secret: totp.secret.base32,
        uri: totp.toString(),
    };
}

export function verifyToken(secret: string, token: string): boolean {
    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}

export async function generateQRCode(uri: string): Promise<string> {
    return QRCode.toDataURL(uri);
}

export function generateBackupCodes(count: number = 8): { codes: string[]; hashed: string[] } {
    const codes: string[] = [];
    const hashed: string[] = [];

    for (let i = 0; i < count; i++) {
        const code = randomBytes(4).toString("hex").toUpperCase();
        const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
        codes.push(formatted);
        hashed.push(hashBackupCode(formatted));
    }

    return { codes, hashed };
}

export function hashBackupCode(code: string): string {
    return createHash("sha256").update(code.replace("-", "").toUpperCase()).digest("hex");
}

export function verifyBackupCode(code: string, hashedCodes: string[]): { valid: boolean; remaining: string[] } {
    const hash = hashBackupCode(code);
    const index = hashedCodes.indexOf(hash);

    if (index === -1) {
        return { valid: false, remaining: hashedCodes };
    }

    const remaining = [...hashedCodes];
    remaining.splice(index, 1);
    return { valid: true, remaining };
}
