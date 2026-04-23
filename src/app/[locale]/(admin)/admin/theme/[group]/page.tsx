import { notFound } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { getActiveTheme } from "@/core/lib/theme-state";
import { SchemaForm } from "@/core/components/admin/theme-settings/SchemaForm";

export default async function ThemeSettingsPage({ params }: { params: Promise<{ group: string }> }) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) notFound();

    const { group } = await params;
    const { themeId, manifest } = await getActiveTheme();
    const groupDef = manifest.settings?.[group];
    if (!groupDef) notFound();

    const rows = await prisma.themeSetting.findMany({ where: { themeId, groupKey: group } });
    const initialValues = Object.fromEntries(rows.map(r => [r.key, r.value]));

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">{groupDef.label}</h1>
            <SchemaForm themeId={themeId} group={group} fields={groupDef.fields} initialValues={initialValues} />
        </div>
    );
}
