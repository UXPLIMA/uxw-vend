"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/core/components/ui/button";
import { Label } from "@/core/components/ui/label";

export interface FileUploadProps {
    value: string | null;
    onChange: (url: string | null) => void;
    accept?: string;
    label?: string;
}

/**
 * Looks like an image based on either the accept MIME prefix or the URL extension.
 */
function looksLikeImage(value: string | null, accept?: string): boolean {
    if (accept && accept.startsWith("image/")) return true;
    if (!value) return false;
    return /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(value);
}

export function FileUpload({ value, onChange, accept, label }: FileUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const isImage = looksLikeImage(value, accept);

    const handlePick = () => {
        inputRef.current?.click();
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/v1/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Upload failed");
                return;
            }

            const data = (await res.json()) as { url: string; path: string };
            onChange(data.url);
            toast.success("File uploaded");
        } catch {
            toast.error("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = () => {
        onChange(null);
    };

    return (
        <div className="space-y-2">
            {label && <Label>{label}</Label>}

            {value && (
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                    {isImage ? (
                        // Uploaded/user-provided URLs may be local or external — use plain img tag
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={value}
                            alt="Preview"
                            className="h-20 w-20 rounded object-contain border border-border bg-muted p-1"
                        />
                    ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-muted-foreground" title={value}>
                            {value}
                        </p>
                        <div className="mt-2 flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handlePick}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                    <Upload className="mr-1 h-3 w-3" />
                                )}
                                Replace
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRemove}
                                disabled={uploading}
                            >
                                <X className="mr-1 h-3 w-3" />
                                Remove
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {!value && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={handlePick}
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload file
                        </>
                    )}
                </Button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleChange}
                className="hidden"
            />
        </div>
    );
}
