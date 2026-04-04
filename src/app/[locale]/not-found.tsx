"use client";

import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
            <div className="text-center max-w-md">
                <div className="text-[120px] font-black text-gray-200 leading-none select-none mb-4">
                    404
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
                <p className="text-gray-500 mb-8">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link href="/">
                        <Button>
                            <Home className="w-4 h-4 mr-2" /> Go Home
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
