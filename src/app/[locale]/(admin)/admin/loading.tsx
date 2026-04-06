import { Loader2 } from "lucide-react";

export default function AdminLoading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
    );
}
