"use client";

import { useState, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import { Cookie } from "lucide-react";

export function CookieConsent() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem("cookie_consent");
        if (!consent) setShow(true);
    }, []);

    const accept = () => {
        localStorage.setItem("cookie_consent", "accepted");
        setShow(false);
    };

    const reject = () => {
        localStorage.setItem("cookie_consent", "rejected");
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
            <div className="container mx-auto max-w-3xl">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <Cookie className="w-8 h-8 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">
                            We use cookies to improve your experience. By continuing to use this site, you agree to our use of cookies.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" onClick={reject}>
                            Reject
                        </Button>
                        <Button size="sm" onClick={accept}>
                            Accept
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
