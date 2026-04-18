"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";

interface CurrencyContextType {
    currency: string;
    symbol: string;
    rate: number;
    format: (amount: number | string | unknown) => string;
    formatPrice: (amount: number | string | unknown) => string;
    setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
    currency: "USD",
    symbol: "$",
    rate: 1,
    format: (amount: number | string | unknown) => `$${(Number(amount) || 0).toFixed(2)}`,
    formatPrice: (amount: number | string | unknown) => `$${(Number(amount) || 0).toFixed(2)}`,
    setCurrency: () => {},
});

export function useCurrency() {
    return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrency] = useState("USD");
    const [symbol, setSymbol] = useState("$");
    const [rate, setRate] = useState(1);

    useEffect(() => {
        const saved = localStorage.getItem("preferred_currency");
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCurrency(data.currency || "USD");
                setSymbol(data.symbol || "$");
                setRate(data.rate || 1);
            } catch { /* ignore */ }
        }
    }, []);

    const format = (amount: number | string | unknown) => {
        const num = Number(amount) || 0;
        return `${symbol}${(num * rate).toFixed(2)}`;
    };

    return (
        <CurrencyContext value={{ currency, symbol, rate, format, formatPrice: format, setCurrency }}>
            {children}
        </CurrencyContext>
    );
}
