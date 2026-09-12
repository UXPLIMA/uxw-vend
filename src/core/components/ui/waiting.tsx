"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/core/lib/utils";

/** Below this, a wait is not worth telling anybody about. */
const PATIENCE_MS = 300;

/**
 * A region that is waiting for its own request.
 *
 * This is the only thing the product draws while data is on its way, and it
 * draws nothing for the first 300ms. A measured admin list answers in about
 * 400ms on this machine, so a placeholder that appears immediately is on
 * screen for a tenth of a second: long enough to see, too short to read, and
 * indistinguishable from a glitch. Past 300ms the wait is real and worth
 * acknowledging.
 *
 * It replaced thirty-four hand drawn page skeletons. Those were a second copy
 * of a layout that nothing kept in step with the first: the list placeholder
 * was eight rows against a twenty row table, and the shop's was a 176px image
 * against a 200px one. This has no shape to fall out of step with.
 *
 * `label` is required and is the caller's to translate. The spinner is
 * decoration; the sentence is what a screen reader is given, and it is
 * announced from the first moment rather than after the delay, because
 * somebody listening should not be told a page is empty for a third of a
 * second first.
 */
export function Waiting({ label, className }: { label: string; className?: string }) {
    const [patienceSpent, setPatienceSpent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setPatienceSpent(true), PATIENCE_MS);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className={cn("flex items-center justify-center py-12", className)} aria-busy="true">
            <span className="sr-only">{label}</span>
            {patienceSpent && (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
        </div>
    );
}
