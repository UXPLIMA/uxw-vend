"use client";

import { useState, useEffect } from "react";

interface ItemSummary {
    total: number;
    active: number;
}

export default function ExampleWidget() {
    const [summary, setSummary] = useState<ItemSummary | null>(null);

    useEffect(() => {
        fetch("/api/v1/my-module/items?limit=1")
            .then((res) => res.json())
            .then((data) => {
                setSummary({
                    total: data.pagination?.total ?? 0,
                    active: data.pagination?.total ?? 0,
                });
            })
            .catch(() => {});
    }, []);

    if (!summary) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">My Module</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {summary.total} items available
            </p>
        </div>
    );
}
