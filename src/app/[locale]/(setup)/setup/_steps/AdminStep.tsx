"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/core/components/ui/input";
import { PasswordInput } from "@/core/components/ui/password-input";
import { checkPasswordPolicy } from "@/core/lib/password-policy";

interface AdminStepProps {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
    setEmail: (v: string) => void;
    setUsername: (v: string) => void;
    setPassword: (v: string) => void;
    setPasswordConfirm: (v: string) => void;
}

export function AdminStep({
    email, username, password, passwordConfirm,
    setEmail, setUsername, setPassword, setPasswordConfirm,
}: AdminStepProps) {
    const t = useTranslations("setup.admin");
    const authT = useTranslations("auth");
    const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
    // Only once they have typed something: an empty field is not a complaint.
    const policy = password.length > 0 ? checkPasswordPolicy(password) : { ok: true };
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            <div className="space-y-3">
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("email")}</span>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("username")}</span>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("password")}</span>
                    <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" showLabel={authT("showPassword")} hideLabel={authT("hidePassword")} />
                    {policy.ok ? (
                        <span className="text-xs text-muted-foreground">{t("passwordHint")}</span>
                    ) : (
                        <span className="text-xs text-destructive">{policy.message}</span>
                    )}
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("passwordConfirm")}</span>
                    <PasswordInput value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" showLabel={authT("showPassword")} hideLabel={authT("hidePassword")} />
                    {mismatch && <span className="text-xs text-red-600">{t("mismatch")}</span>}
                </label>
            </div>
        </div>
    );
}
