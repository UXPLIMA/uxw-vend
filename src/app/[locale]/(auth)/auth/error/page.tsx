"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle } from "lucide-react";

const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification link has expired or has already been used.",
    OAuthSignin: "Error in constructing an authorization URL.",
    OAuthCallback: "Error in handling the response from the OAuth provider.",
    OAuthCreateAccount: "Could not create OAuth provider user in the database.",
    EmailCreateAccount: "Could not create email provider user in the database.",
    Callback: "Error in the OAuth callback handler route.",
    OAuthAccountNotLinked: "This email is already associated with another account. Sign in with the original provider.",
    Default: "An authentication error occurred.",
};

export default function AuthErrorPage() {
    const searchParams = useSearchParams();
    const errorType = searchParams.get("error") || "Default";
    const message = errorMessages[errorType] || errorMessages.Default;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
                <p className="text-gray-600 mb-8">{message}</p>
                <div className="flex gap-3 justify-center">
                    <Link href="/auth/login">
                        <Button>Try Again</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline">Go Home</Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
