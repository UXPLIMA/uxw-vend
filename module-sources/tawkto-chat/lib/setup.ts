/**
 * The two ids an operator pasted from the provider's dashboard.
 *
 * Apart from `embed.ts` so that file stays importable without dragging a
 * server bundle behind it.
 */
import { prisma } from "@/core/sdk/server";

export const PROPERTY_KEY = "tawkto_property_id";
export const WIDGET_KEY = "tawkto_widget_id";

export async function chatIds(): Promise<{ propertyId: string; widgetId: string }> {
    const rows = await prisma.setting.findMany({ where: { key: { in: [PROPERTY_KEY, WIDGET_KEY] } } });
    const map = new Map(rows.map((row) => [row.key, typeof row.value === "string" ? row.value.trim() : ""]));
    return {
        propertyId: map.get(PROPERTY_KEY) ?? "",
        widgetId: map.get(WIDGET_KEY) ?? "",
    };
}
