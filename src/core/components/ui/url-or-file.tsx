"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link as LinkIcon, Upload } from "lucide-react";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { FileUpload } from "@/core/components/ui/file-upload";
import { Radio } from "@/core/components/ui/radio";

export interface UrlOrFileProps {
    value: string;
    onChange: (url: string) => void;
    label?: string;
    accept?: string;
    placeholder?: string;
}

type Mode = "link" | "upload";

function detectMode(value: string): Mode {
    if (value && value.startsWith("/uploads/")) return "upload";
    return "link";
}

export function UrlOrFile({
    value,
    onChange,
    label,
    accept,
    placeholder = "https://...",
}: UrlOrFileProps) {
    const t = useTranslations("common");
    const [mode, setMode] = useState<Mode>(() => detectMode(value));

    const handleModeChange = (next: Mode) => {
        setMode(next);
    };

    return (
        <div className="space-y-2">
            {label && <Label>{label}</Label>}

            <div className="flex gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
                    <Radio
                        name={`url-or-file-${label || "field"}`}
                        checked={mode === "link"}
                        onChange={() => handleModeChange("link")}
                    />
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span>{t("linkUrl")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
                    <Radio
                        name={`url-or-file-${label || "field"}`}
                        checked={mode === "upload"}
                        onChange={() => handleModeChange("upload")}
                    />
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t("uploadFile")}</span>
                </label>
            </div>

            {mode === "link" ? (
                <Input
                    type="url"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder} aria-label={placeholder}
                />
            ) : (
                <FileUpload
                    value={value || null}
                    onChange={(url) => onChange(url || "")}
                    accept={accept}
                />
            )}
        </div>
    );
}
