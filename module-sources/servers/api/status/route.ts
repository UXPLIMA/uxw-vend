/**
 * Public server status.
 *
 * The flat fields describe the default server and are what this endpoint has
 * always returned; a theme or a script written against the old shape keeps
 * working. `servers` is the new part: every active server, each asked in the
 * protocol it speaks.
 */
import { NextResponse } from "next/server";
import { getServerStatus, getAllServerStatuses } from "../../lib/server-query";

export async function GET() {
    const [status, servers] = await Promise.all([getServerStatus(), getAllServerStatuses()]);
    return NextResponse.json({ ...status, servers });
}
