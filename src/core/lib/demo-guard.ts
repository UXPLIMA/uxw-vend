import { NextResponse } from "next/server";

/**
 * Demo write-protection. Enabled when DEMO_MODE=1 (set only on the public
 * demo instance). Lets visitors break in, click around, register, vote,
 * post, etc. — but blocks destructive admin actions so a single visitor
 * can't wreck the demo for everyone.
 *
 * Use at the top of any admin/destructive API route:
 *
 *     const blocked = demoBlock();
 *     if (blocked) return blocked;
 *
 * Returns a 403 NextResponse to short-circuit the handler, or undefined
 * to continue. We block by call site (not URL pattern) so the list lives
 * with the code it protects and stays accurate when routes get renamed.
 */
export function isDemoMode(): boolean {
    return process.env.DEMO_MODE === "1";
}

export function demoBlock(): NextResponse | undefined {
    if (!isDemoMode()) return undefined;
    return NextResponse.json(
        { error: "This action is disabled in the demo. Spin up your own instance to try it." },
        { status: 403 },
    );
}
