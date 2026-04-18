"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { FooterDropdown } from "@/core/components/ui/footer-dropdown";
import { useCurrency, currencies, type CurrencyCode } from "../lib/context";

interface ConfiguredCurrency {
    code: string;
    symbol: string;
    enabled: boolean;
}

export function CurrencySelector() {
    const { currency, setCurrency } = useCurrency();
    const [available, setAvailable] = useState<ConfiguredCurrency[]>([]);

    useEffect(() => {
        // Try to load admin-configured currencies; fall back to built-in list
        fetch("/api/v1/currency")
            .then((r) => r.json())
            .then((d) => {
                if (d?.currencies && Array.isArray(d.currencies)) {
                    setAvailable(d.currencies.filter((c: ConfiguredCurrency) => c.enabled !== false));
                }
            })
            .catch(() => {
                /* ignore — fallback below */
            });
    }, []);

    const list = available.length > 0 ? available : currencies.map((c) => ({ code: c.code, symbol: c.symbol, enabled: true }));
    const codes = list.map((c) => c.code);
    const formatLabel = (code: string) => {
        const c = list.find((x) => x.code === code);
        return c ? `${c.symbol} ${c.code}` : code;
    };

    return (
        <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <FooterDropdown
                options={codes}
                value={currency}
                onChange={(v) => setCurrency(v as CurrencyCode)}
                formatLabel={formatLabel}
            />
        </div>
    );
}

export default CurrencySelector;
