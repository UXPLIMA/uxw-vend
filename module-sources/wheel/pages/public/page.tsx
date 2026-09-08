"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, CardContent, LoadFailed, useLocalDate } from "@/core/sdk/ui";
import { PageFrame } from "@/core/sdk/layout";
import { Coins, Gift, Loader2, Lock, PartyPopper, Timer } from "lucide-react";
import { errorMessage } from "@/core/sdk";

/**
 * The wheels a site runs, and the one this reader is looking at.
 *
 * The old page drew a 320px canvas with the prize names written around it in
 * 10px type, which on a phone was a grey disc with smudges on it, and it knew
 * about exactly one wheel because that is all there was. A site can run
 * several now - a free daily one, a weekly one for a rank, one that costs
 * credits - so the page picks between them and says, for each, whether this
 * reader may turn it and when.
 *
 * The wheel itself is SVG rather than canvas: it scales to the screen it is
 * on, the labels are text a screen reader can read, and the turn is one CSS
 * transition rather than an animation loop.
 */

interface Prize {
    id: string;
    name: string;
    type: string;
    value: number;
    color: string;
}

type Refusal = "signed_out" | "wheel_off" | "wrong_role" | "too_soon" | "not_enough_credits" | null;

interface Wheel {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    cost: number;
    cooldown: string;
    cooldownHours: number;
    restricted: boolean;
    prizes: Prize[];
    canTurn: boolean;
    refusal: Refusal;
    nextTurnAt: string | null;
}

/** Where the pointer sits, in degrees clockwise from the top. */
const POINTER_AT = 0;
/** Full turns before the wheel settles, so a turn reads as a turn. */
const FLOURISH = 6;

function polarToCartesian(cx: number, cy: number, radius: number, degrees: number) {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

/** One slice of the wheel, as an SVG path. */
function slicePath(cx: number, cy: number, radius: number, from: number, to: number): string {
    const start = polarToCartesian(cx, cy, radius, to);
    const end = polarToCartesian(cx, cy, radius, from);
    const large = to - from <= 180 ? "0" : "1";
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

export default function WheelPage() {
    const t = useTranslations("wheel");
    const commonT = useTranslations("common");
    const { data: session } = useSession();
    const formatLocalDate = useLocalDate();

    const [wheels, setWheels] = useState<Wheel[]>([]);
    const [activeSlug, setActiveSlug] = useState<string | null>(null);
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [turning, setTurning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<{ name: string; type: string; value: number; code?: string | null } | null>(null);
    const [refused, setRefused] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/wheel/wheels")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d) => {
                if (cancelled) return;
                const rows: Wheel[] = d.wheels ?? [];
                setWheels(rows);
                setCredits(Number(d.credits ?? 0));
                setActiveSlug((current) => current && rows.some((w) => w.slug === current) ? current : rows[0]?.slug ?? null);
                setFailed(false);
                setLoading(false);
            })
            .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
        return () => { cancelled = true; };
    }, [reloadKey]);

    const wheel = useMemo(
        () => wheels.find((w) => w.slug === activeSlug) ?? wheels[0] ?? null,
        [wheels, activeSlug],
    );

    const turn = async () => {
        if (!wheel || turning) return;
        setTurning(true);
        setResult(null);
        setRefused(null);
        try {
            const res = await fetch(`/api/v1/wheel/spin?wheel=${encodeURIComponent(wheel.slug)}`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                setRefused(t.has(`refusal_${data.code ?? ""}`) ? t(`refusal_${data.code}`) : errorMessage(data, commonT("somethingWentWrong"), commonT));
                setTurning(false);
                return;
            }

            // Stop with the winning slice under the pointer, after a few whole
            // turns so it reads as a wheel rather than a jump.
            const slices = wheel.prizes.length;
            const sliceAngle = 360 / slices;
            const target = 360 * FLOURISH + (POINTER_AT - (data.prize.index * sliceAngle + sliceAngle / 2));
            setRotation((previous) => previous + ((target - (previous % 360)) % 360) + 360 * FLOURISH);

            // The slice has to arrive before the announcement does.
            window.setTimeout(() => {
                setResult(data.prize);
                setTurning(false);
                setReloadKey((k) => k + 1);
            }, 4200);
        } catch {
            setRefused(commonT("somethingWentWrong"));
            setTurning(false);
        }
    };

    const cooldownLabel = (w: Wheel) =>
        w.cooldown === "custom" ? t("cooldown_customEvery", { hours: w.cooldownHours }) : t(`cooldown_${w.cooldown}`);

    const refusalLabel = (w: Wheel) => {
        if (!w.refusal) return null;
        if (w.refusal === "too_soon" && w.nextTurnAt) {
            return t("refusal_wheel_too_soon_at", { when: formatLocalDate(w.nextTurnAt) });
        }
        return t.has(`refusal_wheel_${w.refusal}`) ? t(`refusal_wheel_${w.refusal}`) : null;
    };

    return (
        <PageFrame
            title={t("title")}
            description={t("description")}
            sidebar={wheel ? (
                <div className="space-y-5">
                    <div className="bg-card rounded-xl border border-border p-5">
                        <h2 className="font-bold text-foreground mb-3">{t("thisWheel")}</h2>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">{t("howOften")}</dt>
                                <dd className="text-foreground text-right">{cooldownLabel(wheel)}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">{t("costsPerTurn")}</dt>
                                <dd className="text-foreground text-right">
                                    {wheel.cost > 0 ? t("credits", { count: wheel.cost }) : t("free")}
                                </dd>
                            </div>
                            {session?.user && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">{t("yourCredits")}</dt>
                                    <dd className="text-foreground text-right">{credits}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    {wheel.prizes.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-5">
                        <h2 className="font-bold text-foreground mb-3">{t("whatIsOnIt")}</h2>
                        <ul className="space-y-2 text-sm">
                            {wheel.prizes.map((prize) => (
                                <li key={prize.id} className="flex items-center gap-2">
                                    <span
                                        className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                                        style={{ backgroundColor: prize.color }}
                                        aria-hidden="true"
                                    />
                                    <span className="text-foreground">{prize.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    )}
                </div>
            ) : null}
        >
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : failed ? (
                <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
            ) : wheels.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">{t("noWheels")}</CardContent></Card>
            ) : (
                <div className="space-y-6">
                    {wheels.length > 1 && (
                        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("pickAWheel")}>
                            {wheels.map((w) => (
                                <Button
                                    key={w.slug}
                                    role="tab"
                                    aria-selected={w.slug === wheel?.slug}
                                    variant={w.slug === wheel?.slug ? "default" : "outline"}
                                    onClick={() => { setActiveSlug(w.slug); setResult(null); setRefused(null); }}
                                >
                                    {w.restricted && <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                                    {w.name}
                                    {w.cost > 0 && (
                                        // The button spaces its own children; a
                                        // margin here is the thing that drifts.
                                        <span className="inline-flex items-center gap-1 text-xs opacity-80">
                                            <Coins className="w-3 h-3" aria-hidden="true" />{w.cost}
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>
                    )}

                    {wheel && wheel.prizes.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <Gift className="w-8 h-8 mx-auto mb-3 opacity-40" aria-hidden="true" />
                                <p>{t("refusal_wheel_no_prizes")}</p>
                            </CardContent>
                        </Card>
                    )}

                    {wheel && wheel.prizes.length > 0 && (
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex flex-col items-center gap-6">
                                    {wheel.description && (
                                        <p className="text-center text-muted-foreground">{wheel.description}</p>
                                    )}

                                    <div className="relative w-full max-w-[420px] aspect-square">
                                        {/* The pointer, over the wheel rather than on it. */}
                                        <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10">
                                            <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-primary drop-shadow" />
                                        </div>

                                        <svg
                                            viewBox="0 0 200 200"
                                            className="w-full h-full drop-shadow-sm"
                                            style={{
                                                transform: `rotate(${rotation}deg)`,
                                                transition: turning ? "transform 4s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                                            }}
                                            role="img"
                                            aria-label={t("wheelWith", { count: wheel.prizes.length })}
                                        >
                                            {wheel.prizes.map((prize, index) => {
                                                const slice = 360 / wheel.prizes.length;
                                                const from = index * slice;
                                                const mid = from + slice / 2;
                                                const label = polarToCartesian(100, 100, 62, mid);
                                                return (
                                                    <g key={prize.id}>
                                                        <path
                                                            d={slicePath(100, 100, 96, from, from + slice)}
                                                            fill={prize.color}
                                                            stroke="var(--color-card)"
                                                            strokeWidth="1"
                                                        />
                                                        <text
                                                            x={label.x}
                                                            y={label.y}
                                                            fill="#ffffff"
                                                            fontSize="7"
                                                            fontWeight="600"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            transform={`rotate(${mid} ${label.x} ${label.y})`}
                                                        >
                                                            {prize.name.length > 18 ? `${prize.name.slice(0, 17)}…` : prize.name}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                            <circle cx="100" cy="100" r="16" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="2" />
                                        </svg>
                                    </div>

                                    {result ? (
                                        <div className="text-center space-y-2" role="status">
                                            <PartyPopper className="w-8 h-8 text-primary mx-auto" aria-hidden="true" />
                                            <p className="text-lg font-bold text-foreground">{result.name}</p>
                                            {result.code && (
                                                <p className="text-sm text-muted-foreground">
                                                    {t("couponCode")}: <span className="font-mono text-foreground">{result.code}</span>
                                                </p>
                                            )}
                                        </div>
                                    ) : refused ? (
                                        <p role="alert" className="text-center text-sm text-destructive">{refused}</p>
                                    ) : null}

                                    <div className="flex flex-col items-center gap-2">
                                        <Button size="lg" onClick={turn} disabled={turning || !wheel.canTurn}>
                                            {turning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                                            {wheel.cost > 0 ? t("turnForCredits", { count: wheel.cost }) : t("turn")}
                                        </Button>
                                        {!wheel.canTurn && refusalLabel(wheel) && (
                                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                {wheel.refusal === "too_soon" ? <Timer className="w-3.5 h-3.5" aria-hidden="true" /> : null}
                                                {refusalLabel(wheel)}
                                            </p>
                                        )}
                                        {wheel.restricted && (
                                            <Badge tone="info">{t("membersOnly")}</Badge>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </PageFrame>
    );
}
