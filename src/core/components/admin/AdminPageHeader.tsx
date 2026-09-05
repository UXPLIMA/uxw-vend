import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";
import { buttonClassName } from "@/core/components/ui/button";
import { cn } from "@/core/lib/utils";

/**
 * The top of an admin screen: where it is, what it is, and what you can do
 * from here.
 *
 * Eighty screens had written this by hand and no two agreed. The heading came
 * in twelve sizes - `text-3xl font-bold` on fifty-one of them, `text-xl
 * font-semibold` on twenty-five, and one `text-lg font-medium` - so moving
 * between two screens changed the size of the title. The row was
 * `justify-between items-center mb-8 gap-4 flex-wrap` here and `items-start
 * mb-6` there, so the action button sat at a different height and a different
 * distance from the table below it. The way back from a create form was a
 * top-right outline button on one screen and an arrow left of the title on
 * another, and on a third it was missing.
 *
 * One component, one set of choices:
 *
 *   - the title is `text-2xl font-bold`, once, everywhere;
 *   - the actions sit on the right of the title, aligned to its top, and wrap
 *     underneath on a narrow screen rather than squeezing the title;
 *   - a way back, when there is one, is a quiet link ABOVE the title, so it
 *     never competes with the screen's primary action for the same corner.
 *
 * Actions are buttons the caller passes in. `Button` already spaces its own
 * icon, so an action is written `<Button><Plus className="w-4 h-4" />{label}
 * </Button>` with no margin on the icon.
 */
interface AdminPageHeaderBase {
    title: React.ReactNode;
    /** One quiet line under the title. */
    description?: React.ReactNode;
    /** Buttons, on the right. */
    actions?: React.ReactNode;
    className?: string;
}

/**
 * A way back comes with its wording. The component cannot supply a default
 * one: it renders on the server as well as in the client, so it has no
 * translator of its own, and a bare arrow with no label is a link a screen
 * reader reads as nothing at all.
 *
 * Two kinds of "back", because the panel has two kinds of form. One is a
 * route, and leaves by an address. The other is a card that a list screen
 * unfolds in place, and leaves by setting a flag - there is nowhere to link
 * to. Both are the same control in the same corner.
 */
type AdminPageHeaderProps =
    | (AdminPageHeaderBase & { backHref: string; onBack?: never; backLabel: React.ReactNode })
    | (AdminPageHeaderBase & { onBack: () => void; backHref?: never; backLabel: React.ReactNode })
    | (AdminPageHeaderBase & { backHref?: never; onBack?: never; backLabel?: never });

export type { AdminPageHeaderProps };

export function AdminPageHeader({
    title,
    description,
    backHref,
    onBack,
    backLabel,
    actions,
    className,
}: AdminPageHeaderProps) {
    // Pulled left by its own padding so the words line up with the title
    // underneath rather than sitting indented from it.
    const backClass = cn(buttonClassName("ghost", "sm"), "-ml-3 mb-1");
    return (
        <div className={cn("mb-6", className)}>
            {backHref && (
                <Link href={backHref} className={backClass}>
                    <ArrowLeft className="w-4 h-4" />
                    {backLabel}
                </Link>
            )}
            {onBack && (
                <button type="button" onClick={onBack} className={backClass}>
                    <ArrowLeft className="w-4 h-4" />
                    {backLabel}
                </button>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && (
                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    )}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
            </div>
        </div>
    );
}
