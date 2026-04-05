"use client";

import { useState, useEffect } from "react";

interface WidgetData {
    total: number;
}

export function ExampleWidget() {
    const [data, setData] = useState<WidgetData | null>(null);

    useEffect(() => {
        fetch("/api/v1/my-module/items?limit=1")
            .then((res) => res.json())
            .then((res) => setData({ total: res.pagination?.total ?? 0 }))
            .catch(() => {});
    }, []);

    if (!data) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">My Module Stats</h3>
            </div>
            <p className="text-2xl font-bold text-blue-600">{data.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total items</p>
        </div>
    );
}

export default ExampleWidget;
