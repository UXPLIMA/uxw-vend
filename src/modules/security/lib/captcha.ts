const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

export function getCaptchaEnabled(): boolean {
    return !!(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && TURNSTILE_SECRET);
}

/**
 * Verify Cloudflare Turnstile token server-side
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
    if (!TURNSTILE_SECRET) return true; // Skip if not configured

    try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: TURNSTILE_SECRET,
                response: token,
            }),
        });

        const data = await res.json();
        return data.success === true;
    } catch {
        return false;
    }
}
