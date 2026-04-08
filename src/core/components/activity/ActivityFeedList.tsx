import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    Bell,
    BookOpen,
    ClipboardList,
    Coins,
    Download,
    FileText,
    Gift,
    GitBranch,
    Lightbulb,
    Megaphone,
    MessageSquare,
    ShoppingBag,
    ThumbsUp,
    Ticket,
    UserCog,
    UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/core/components/ui/card";

type IconComponent = React.ComponentType<{ className?: string }>;

const ICON_MAP: Record<string, IconComponent> = {
    FileText,
    ShoppingBag,
    MessageSquare,
    Ticket,
    Lightbulb,
    GitBranch,
    Megaphone,
    BookOpen,
    ClipboardList,
    Download,
    ThumbsUp,
    Gift,
    Coins,
    UserPlus,
    AlertTriangle,
    Bell,
    UserCog,
    Activity,
};

export function getActivityIcon(name: string | null | undefined): IconComponent {
    if (!name) return Activity;
    return ICON_MAP[name] || Activity;
}

export interface ActivityItem {
    id: string;
    type: string;
    title: string;
    body: string | null;
    href: string | null;
    icon: string | null;
    isPublic: boolean;
    createdAt: string | Date;
    actor: { id: string; username: string; avatar: string | null } | null;
}

export function ActivityFeedList({ items, emptyMessage = "No recent activity yet." }: {
    items: ActivityItem[];
    emptyMessage?: string;
}) {
    if (items.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                    {emptyMessage}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-2">
            {items.map((item) => {
                const Icon = getActivityIcon(item.icon);
                const when = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
                return (
                    <Card key={item.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-3 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                    {item.href ? (
                                        <Link href={item.href} className="text-sm text-foreground hover:text-primary truncate">
                                            {item.title}
                                        </Link>
                                    ) : (
                                        <span className="text-sm text-foreground truncate">{item.title}</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">{when}</span>
                                </div>
                                {item.actor && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        <Link href={`/profile/${item.actor.username}`} className="hover:text-primary">
                                            {item.actor.username}
                                        </Link>
                                    </div>
                                )}
                                {item.body && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
