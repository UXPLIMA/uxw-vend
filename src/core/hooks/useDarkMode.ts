"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Shared dark mode hook — syncs state across components via storage events.
 * Single source of truth for dark mode toggle.
 */
export function useDarkMode() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Read initial state from DOM (set by inline script in layout)
        const dark = document.documentElement.getAttribute("data-mode") === "dark";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading DOM on mount
        setIsDark(dark);

        // Listen for changes from other components/tabs
        const handleStorage = (e: StorageEvent) => {
            if (e.key === "color-mode") {
                const newDark = e.newValue === "dark";
                setIsDark(newDark);
                if (newDark) document.documentElement.setAttribute("data-mode", "dark");
                else document.documentElement.removeAttribute("data-mode");
            }
        };

        // Listen for custom event (same-tab sync)
        const handleCustom = () => {
            setIsDark(document.documentElement.getAttribute("data-mode") === "dark");
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener("darkmode-change", handleCustom);
        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("darkmode-change", handleCustom);
        };
    }, []);

    const toggle = useCallback(() => {
        const newDark = !isDark;
        setIsDark(newDark);
        if (newDark) {
            document.documentElement.setAttribute("data-mode", "dark");
            localStorage.setItem("color-mode", "dark");
        } else {
            document.documentElement.removeAttribute("data-mode");
            localStorage.setItem("color-mode", "light");
        }
        // Notify other components in the same tab
        window.dispatchEvent(new Event("darkmode-change"));
    }, [isDark]);

    return { isDark, toggle };
}
