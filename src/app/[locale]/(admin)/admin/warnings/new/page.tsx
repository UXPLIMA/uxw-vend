"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { UserPicker, type PickedUser } from "@/core/components/admin/UserPicker";
import { Link, useRouter } from "@/core/lib/i18n/navigation";
import { writeError } from "@/core/lib/write-result";
import { toast } from "sonner";

/** Issuing a warning, on its own route rather than folded above the list. */
export default function NewWarningPage() {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");
    const router = useRouter();

    const [user, setUser] = useState<PickedUser | null>(null);
    const [reason, setReason] = useState("");
    const [points, setPoints] = useState("1");
    const [expiresAt, setExpiresAt] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error(t("warnings_selectUser"));
            return;
        }
        if (!reason.trim()) {
            toast.error(t("warnings_reasonRequired"));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/warnings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    reason: reason.trim(),
                    points: Number(points) || 1,
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                }),
            });
            const failed = await writeError(res, commonT("somethingWentWrong"), t);
            if (failed) {
                toast.error(failed);
                return;
            }
            toast.success(t("warnings_issued"));
            router.push("/admin/warnings");
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold">{t("warnings_newTitle")}</h1>
                    <p className="text-sm text-muted-foreground">{t("warnings_subtitle")}</p>
                </div>
                <Link href="/admin/warnings" className="inline-flex">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {commonT("back")}
                    </Button>
                </Link>
            </div>

            <Card>
                <CardContent className="p-6">
                    <form onSubmit={submit} className="space-y-4 max-w-xl">
                        <UserPicker
                            id="warning-user"
                            value={user}
                            onChange={setUser}
                            label={t("warnings_user")}
                            placeholder={t("warnings_userPlaceholder")}
                            required
                        />
                        <div>
                            <Label htmlFor="warning-reason">{t("warnings_reason")}</Label>
                            <Textarea
                                id="warning-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                required
                            />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="warning-points">{t("warnings_points")}</Label>
                                <Input
                                    id="warning-points"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={points}
                                    onChange={(e) => setPoints(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="warning-expires">{t("warnings_expiresAt")}</Label>
                                <Input
                                    id="warning-expires"
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("warnings_issuing")}
                                    </>
                                ) : (
                                    t("warnings_issue")
                                )}
                            </Button>
                            <Link href="/admin/warnings" className="inline-flex">
                                <Button type="button" variant="outline" disabled={saving}>
                                    {commonT("cancel")}
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
