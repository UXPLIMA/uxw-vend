/**
 * The id an operator pasted from the provider's dashboard.
 *
 * Apart from `embed.ts` so that file stays importable without dragging a
 * server bundle behind it.
 */
import { prisma } from "@/core/sdk/server";
import { WEBSITE_KEY } from "./embed";

export async function crispWebsiteId(): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key: WEBSITE_KEY } });
    return typeof row?.value === "string" ? row.value.trim() : "";
}
