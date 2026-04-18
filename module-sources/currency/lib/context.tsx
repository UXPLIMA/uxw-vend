"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// Supported currencies
export const currencies = [
    { code: 'USD', symbol: '$', rate: 1.0, name: 'US Dollar' },
    { code: 'EUR', symbol: '€', rate: 0.92, name: 'Euro' },
    { code: 'TRY', symbol: '₺', rate: 32.50, name: 'Turkish Lira' },
    { code: 'GBP', symbol: '£', rate: 0.79, name: 'British Pound' },
    { code: 'RUB', symbol: '₽', rate: 92.50, name: 'Russian Ruble' },
    { code: 'BRL', symbol: 'R$', rate: 5.15, name: 'Brazilian Real' },
] as const;

export type CurrencyCode = typeof currencies[number]['code'];

interface CurrencyContextType {
    currency: CurrencyCode;
    setCurrency: (code: CurrencyCode) => void;
    formatPrice: (price: number) => string;
    symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrency] = useState<CurrencyCode>('USD');

    // Load saved currency from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('currency');
        if (saved && currencies.some(c => c.code === saved)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCurrency(saved as CurrencyCode);
        }
    }, []);

    // Save currency to localStorage when changed
    useEffect(() => {
        localStorage.setItem('currency', currency);
    }, [currency]);

    const activeCurrency = currencies.find(c => c.code === currency) || currencies[0];

    const formatPrice = (price: number) => {
        // Convert price (assuming base price is always USD)
        const converted = price * activeCurrency.rate;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: activeCurrency.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(converted);
    };

    return (
        <CurrencyContext.Provider value={{
            currency,
            setCurrency,
            formatPrice,
            symbol: activeCurrency.symbol
        }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
