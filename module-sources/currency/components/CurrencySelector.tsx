"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { FooterDropdown, useSiteCurrency } from "@/core/sdk/ui";

interface ConfiguredCurrency {
    code: string;
    symbol: string;
    rate: number;
    enabled?: boolean;
}

interface CurrencyConfig {
    base: string;
    currencies: ConfiguredCurrency[];
}

/**
 * The footer's currency picker.
 *
 * It used to write the visitor's choice into a React context defined inside
 * this module, which no page outside this module could import. The store and
 * the leaderboard each shipped their own copy of that context, neither of
 * them mounted, so every price on the site was drawn by the copies' default
 * formatter: a dollar sign glued to an unconverted number. Picking a currency
 * here changed nothing anywhere.
 *
 * Core owns the price formatter now. This module still owns the rates: it
 * hands core a code and how many of that currency one unit of the site's own
 * currency buys, and every price on the site follows.
 */
export function CurrencySelector() {
    const { base, code, setDisplay } = useSiteCurrency();
    const [config, setConfig] = useState<CurrencyConfig | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/currency")
            .then((r) => (r.ok ? r.json() : null))
            .then((d: CurrencyConfig | null) => {
                if (cancelled || !d?.currencies) return;
                setConfig(d);
            })
            .catch(() => {
                // No config endpoint, no picker: the base currency stands.
            });
        return () => { cancelled = true; };
    }, []);

    const list = (config?.currencies ?? []).filter((c) => c.enabled !== false && c.rate > 0);
    // The configured rates are quoted against the config's own base, which is
    // not necessarily what this site charges in. Re-quote them against the
    // site's currency so a price never gets converted twice.
    const baseRate = list.find((c) => c.code === base)?.rate;
    const options = baseRate ? list : list.filter((c) => c.code === config?.base);

    if (options.length < 2 || !baseRate) return null;

    const choose = (next: string) => {
        if (next === base) { setDisplay(null); return; }
        const target = options.find((c) => c.code === next);
        if (!target) return;
        setDisplay({ code: target.code, rate: target.rate / baseRate });
    };

    const label = (c: string) => {
        const found = options.find((x) => x.code === c);
        return found ? `${found.symbol} ${found.code}` : c;
    };

    return (
        <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <FooterDropdown
                options={options.map((c) => c.code)}
                value={code}
                onChange={choose}
                formatLabel={label}
            />
        </div>
    );
}

export default CurrencySelector;
