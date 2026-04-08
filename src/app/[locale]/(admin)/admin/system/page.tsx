"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
    Database, HardDrive, Cpu, Users, Puzzle, Clock,
    Download, Loader2, Trash2, RefreshCw, Activity, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { SystemMetrics } from "../components/system-metrics";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface SystemData {
    database: { size: string; totalUsers: number; newUsersWeek: number; totalModules: number; enabledModules: number };
    disk: { total: string; used: string; free: string };
    system: {
        nodeVersion: string; platform: string; hostname: string;
        cpuCount: number; cpuModel: string; loadAvg: number[];
        totalMemoryGB: string; freeMemoryGB: string;
        processMemoryMB: { rss: number; heapUsed: number; heapTotal: number };
        uptimeHours: number;
    };
}

interface BackupItem {
    id: string;
    filename: string;
    sizeHuman: string;
    createdAt: string;
    type?: "manual" | "scheduled";
}

export default function SystemPage() {
    const t = useTranslations("admin");
    const [system, setSystem] = useState<SystemData | null>(null);
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [backing, setBacking] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const { confirm } = useConfirm();

    const fetchData = useCallback(async () => {
        const [sysRes, backupRes] = await Promise.all([
            fetch("/api/v1/admin/system").then((r) => r.ok ? r.json() : null),
            fetch("/api/v1/admin/backup").then((r) => r.ok ? r.json() : null),
        ]);
        if (sysRes) setSystem(sysRes);
        if (backupRes) setBackups(backupRes.backups || []);
        setLoading(false);
    }, []);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchData(); }, [fetchData]);

    const createBackup = async () => {
        const ok = await confirm({ title: t("system_createBackupTitle"), message: t("system_createBackupMessage"), confirmText: t("system_createBackup") });
        if (!ok) return;
        setBacking(true);
        const res = await fetch("/api/v1/admin/backup", { method: "POST" });
        if (res.ok) {
            toast.success("Backup created");
            fetchData();
        } else {
            const data = await res.json();
            toast.error(data.error || "Backup failed");
        }
        setBacking(false);
    };

    const downloadBackup = (id: string) => {
        window.location.href = `/api/v1/admin/backup/${encodeURIComponent(id)}/download`;
    };

    const deleteBackup = async (b: BackupItem) => {
        const ok = await confirm({ title: t("system_deleteBackupTitle"), message: t("system_deleteBackupMessage", { filename: b.filename }), variant: "danger", confirmText: "Delete" });
        if (!ok) return;
        const res = await fetch(`/api/v1/admin/backup/${encodeURIComponent(b.id)}`, { method: "DELETE" });
        if (res.ok) { toast.success("Backup deleted"); fetchData(); }
        else { toast.error("Failed to delete"); }
    };

    const restoreBackup = async (b: BackupItem) => {
        const ok = await confirm({
            title: t("system_restoreBackupTitle"),
            message: t("system_restoreBackupMessage", { filename: b.filename }),
            variant: "danger",
            confirmText: "Restore",
        });
        if (!ok) return;
        setRestoring(b.id);
        const res = await fetch(`/api/v1/admin/backup/${encodeURIComponent(b.id)}/restore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmText: "RESTORE" }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            toast.success("Database restored successfully");
            fetchData();
        } else {
            toast.error(data.error || "Restore failed");
        }
        setRestoring(null);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    if (!system) return <p className="text-muted-foreground text-center py-8">{t("system_failedToLoad")}</p>;

    const stats = [
        { label: t("system_databaseSize"), value: system.database.size, icon: Database, color: "text-blue-500" },
        { label: t("system_totalUsers"), value: system.database.totalUsers, icon: Users, color: "text-green-500" },
        { label: t("system_newUsers7d"), value: system.database.newUsersWeek, icon: Activity, color: "text-purple-500" },
        { label: t("system_modules"), value: `${system.database.enabledModules}/${system.database.totalModules}`, icon: Puzzle, color: "text-orange-500" },
        { label: t("system_diskUsed"), value: system.disk.used, icon: HardDrive, color: "text-red-500" },
        { label: t("system_diskFree"), value: system.disk.free, icon: HardDrive, color: "text-emerald-500" },
        { label: t("system_cpuCores"), value: system.system.cpuCount, icon: Cpu, color: "text-indigo-500" },
        { label: t("system_uptime"), value: `${system.system.uptimeHours}h`, icon: Clock, color: "text-amber-500" },
    ];

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("system_title")}</h1>
                    <p className="text-muted-foreground">{system.system.hostname} - {system.system.platform}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4 mr-2" /> {t("system_refresh")}
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {stats.map((s) => (
                    <Card key={s.label}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                                <s.icon className={`w-4 h-4 ${s.color}`} />
                            </div>
                            <div className="text-2xl font-bold">{s.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Process Memory */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t("system_processMemory")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">RSS</span>
                            <span className="font-medium">{system.system.processMemoryMB.rss} MB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Heap Used</span>
                            <span className="font-medium">{system.system.processMemoryMB.heapUsed} MB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Heap Total</span>
                            <span className="font-medium">{system.system.processMemoryMB.heapTotal} MB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">System Total</span>
                            <span className="font-medium">{system.system.totalMemoryGB} GB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">System Free</span>
                            <span className="font-medium">{system.system.freeMemoryGB} GB</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t("system_systemInfo")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Node.js</span>
                            <span className="font-medium">{system.system.nodeVersion}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">CPU</span>
                            <span className="font-medium truncate max-w-[60%]">{system.system.cpuModel}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Load Avg</span>
                            <span className="font-medium">{system.system.loadAvg.join(", ")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Disk Total</span>
                            <span className="font-medium">{system.disk.total}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Backups */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-base">{t("system_backups")}</CardTitle>
                        <Button size="sm" onClick={createBackup} disabled={backing}>
                            {backing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            {backing ? t("system_creating") : t("system_createBackup")}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {backups.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-sm">{t("system_noBackups")}</p>
                    ) : (
                        <div className="divide-y">
                            {backups.map((b) => (
                                <div key={b.id} className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="font-medium text-sm">{b.filename}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString()} - {b.sizeHuman}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => downloadBackup(b.id)} title="Download">
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => restoreBackup(b)} disabled={restoring === b.id} title="Restore">
                                            {restoring === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => deleteBackup(b)} className="text-destructive" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Request Metrics */}
            <div className="mt-8">
                <SystemMetrics />
            </div>
        </>
    );
}
