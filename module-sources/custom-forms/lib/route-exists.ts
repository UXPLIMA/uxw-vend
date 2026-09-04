import { prisma } from "@/core/sdk/server";

/** Does `/form/<slug>` name a form that is still taking answers? */
export default async function customFormExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug) return false;
    const form = await prisma.customForm.findFirst({
        where: { OR: [{ slug }, { id: slug }], isActive: true },
        select: { id: true },
    });
    return form !== null;
}
