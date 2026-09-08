"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/core/sdk/ui";
import { Clock, Lock, Timer } from "lucide-react";

/**
 * What a shopper is told about a product that is not simply for sale.
 *
 * Every one of these states is a different sentence, and saying the wrong one
 * costs a sale: "sold out" for something that comes back tomorrow sends
 * somebody away for good, and "not available" for a Friday-evening offer
 * tells them nothing they can act on. So each state has its own words, and
 * the two that end at a known moment carry a countdown to it.
 */

export interface AvailabilityInfo {
    state: string;
    buyable: boolean;
    opensAt: string | null;
    closesAt: string | null;
    remainingForPerson?: number | null;
    remainingInPeriod?: number | null;
}

/** Ticks once a second, and only while there is something to count. */
function useCountdown(target: string | null): string | null {
    const [left, setLeft] = useState<number | null>(null);

    useEffect(() => {
        if (!target) { setLeft(null); return; }
        const at = new Date(target).getTime();
        const tick = () => setLeft(Math.max(0, at - Date.now()));
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [target]);

    if (left === null) return null;
    const seconds = Math.floor(left / 1000);
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    const rest = seconds % 60;
    if (days > 0) return `${days}g ${hours}s`;
    if (hours > 0) return `${hours}s ${minutes}d`;
    return `${minutes}d ${rest}sn`;
}

export function AvailabilityNote({ info, compact = false }: { info: AvailabilityInfo; compact?: boolean }) {
    const t = useTranslations("store");
    const opensIn = useCountdown(info.state === "open" ? null : info.opensAt);
    const closesIn = useCountdown(info.state === "open" ? info.closesAt : null);

    if (info.state === "open" && !closesIn) return null;

    const tone = info.state === "open" ? "warning" : info.state === "ended" ? "neutral" : "info";
    const icon = info.state === "limit_reached" ? Lock : info.state === "open" ? Timer : Clock;
    const Icon = icon;

    const words = () => {
        switch (info.state) {
            case "open":
                return t("endsIn", { time: closesIn ?? "" });
            case "early":
            case "closed":
            case "sold_out_for_now":
                return opensIn
                    ? t(info.state === "sold_out_for_now" ? "backIn" : "opensIn", { time: opensIn })
                    : t(`state_${info.state}`);
            default:
                return t(`state_${info.state}`);
        }
    };

    if (compact) {
        return (
            <Badge tone={tone}>
                <Icon className="w-3 h-3" aria-hidden="true" />
                {words()}
            </Badge>
        );
    }

    return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Icon className="w-4 h-4" aria-hidden="true" />
            {words()}
        </p>
    );
}
