"use client";

import { useCurrency, currencies, type CurrencyCode } from "../lib/context";

export function CurrencySelector() {
    const { currency, setCurrency } = useCurrency();

    return (
        <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm text-gray-300"
        >
            {currencies.map((c) => (
                <option key={c.code} value={c.code} className="bg-gray-900">
                    {c.symbol} {c.code}
                </option>
            ))}
        </select>
    );
}

export default CurrencySelector;
