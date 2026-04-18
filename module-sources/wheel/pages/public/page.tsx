"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2 } from "lucide-react";

interface Prize {
    id: string;
    name: string;
    type: string;
    value: number;
    color: string;
    probability: number;
}

export default function WheelPage() {
    const { data: session } = useSession();
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [loading, setLoading] = useState(true);
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<{ name: string; type: string; value: number } | null>(null);
    const [freeSpinUsed, setFreeSpinUsed] = useState(false);
    const [spinCost, setSpinCost] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        fetch("/api/v1/wheel/prizes")
            .then((r) => r.json())
            .then((d) => { setPrizes(d.prizes || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Draw wheel
    useEffect(() => {
        if (!canvasRef.current || prizes.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const size = 320;
        canvas.width = size;
        canvas.height = size;

        const center = size / 2;
        const radius = center - 10;
        const sliceAngle = (2 * Math.PI) / prizes.length;

        prizes.forEach((prize, i) => {
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = prize.color;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw text
            ctx.save();
            ctx.translate(center, center);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(prize.name, radius * 0.6, 4);
            ctx.restore();
        });

        // Center circle
        ctx.beginPath();
        ctx.arc(center, center, 20, 0, 2 * Math.PI);
        ctx.fillStyle = "#1f2937";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.stroke();
    }, [prizes]);

    const spin = async () => {
        if (spinning || !session?.user) return;
        setSpinning(true);
        setResult(null);

        try {
            const res = await fetch("/api/v1/wheel/spin", { method: "POST" });
            const data = await res.json();

            if (!res.ok) {
                setResult({ name: data.error, type: "error", value: 0 });
                setSpinning(false);
                return;
            }

            // Animate spin
            const prizeIndex = data.prize.index;
            const sliceAngle = 360 / prizes.length;
            const targetAngle = 360 - (prizeIndex * sliceAngle + sliceAngle / 2);
            const totalRotation = rotation + 1440 + targetAngle; // 4 full rotations + target

            setRotation(totalRotation);

            // Track spin cost and free spin usage
            if (data.cost !== undefined) setSpinCost(data.cost);
            setFreeSpinUsed(true);

            // Show result after animation
            setTimeout(() => {
                setResult(data.prize);
                setSpinning(false);
            }, 4000);
        } catch {
            setSpinning(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 flex flex-col items-center">
                <h1 className="text-3xl font-bold text-foreground mb-2">Wheel of Fortune</h1>
                <p className="text-muted-foreground mb-8">Spin the wheel for a chance to win prizes! One free spin per day.</p>

                {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : prizes.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No prizes configured yet</CardContent></Card>
                ) : (
                    <div className="flex flex-col items-center gap-6">
                        {/* Wheel */}
                        <div className="relative">
                            {/* Pointer */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-red-500" />
                            </div>

                            <div
                                className="transition-transform duration-[4000ms] ease-out"
                                style={{ transform: `rotate(${rotation}deg)` }}
                            >
                                <canvas ref={canvasRef} className="w-[320px] h-[320px]" />
                            </div>
                        </div>

                        {/* Spin Button */}
                        <Button
                            size="lg"
                            className="text-lg px-8"
                            onClick={spin}
                            disabled={spinning || !session?.user}
                        >
                            {spinning ? (
                                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Spinning...</>
                            ) : !session?.user ? (
                                "Login to Spin"
                            ) : freeSpinUsed && spinCost > 0 ? (
                                `Spin Again (${spinCost} credits)`
                            ) : (
                                "Spin!"
                            )}
                        </Button>

                        {/* Result */}
                        {result && (
                            <Card className={`w-full max-w-sm ${result.type === "error" ? "border-red-200" : "border-green-200"}`}>
                                <CardContent className="p-6 text-center">
                                    {result.type === "error" ? (
                                        <p className="text-red-600">{result.name}</p>
                                    ) : result.type === "nothing" ? (
                                        <p className="text-muted-foreground">Better luck next time! You got: <strong>{result.name}</strong></p>
                                    ) : (
                                        <div>
                                            <p className="text-2xl mb-1">🎉</p>
                                            <p className="font-bold text-foreground text-lg">You won: {result.name}!</p>
                                            {result.value > 0 && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {result.type === "credits" ? `${result.value} credits added` : `$${result.value} coupon created`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Prize List */}
                        <div className="w-full max-w-sm">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Available Prizes</h3>
                            <div className="space-y-1">
                                {prizes.map((p) => (
                                    <div key={p.id} className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                        <span className="text-foreground">{p.name}</span>
                                        {p.value > 0 && <span className="text-muted-foreground text-xs">({p.type === "credits" ? `${p.value} credits` : `$${p.value}`})</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
