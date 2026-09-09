"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { PageFrame } from "@/core/sdk/layout";
import { Card, CardContent, LoadFailed } from "@/core/sdk/ui";
import { Link } from "@/core/sdk/navigation";
import { Loader2 } from "lucide-react";

/**
 * A grid of cards.
 *
 * The addresses arrive already checked: the endpoint drops a link or a picture
 * that is neither a path of ours nor a whole https address, so a card here is
 * drawn with what it has. A card whose link was dropped is drawn without one
 * rather than as a link to nowhere.
 */
interface ShowcaseCard {
    id: string;
    title: string;
    body: string | null;
    image: string | null;
    href: string | null;
}

function CardFace({ card }: { card: ShowcaseCard }) {
    return (
        <Card className="h-full overflow-hidden">
            {card.image && (
                <div className="relative aspect-video w-full bg-muted">
                    <Image
                        src={card.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                    />
                </div>
            )}
            <CardContent className="p-5">
                <p className="font-semibold">{card.title}</p>
                {card.body && <p className="mt-1 text-sm text-muted-foreground">{card.body}</p>}
            </CardContent>
        </Card>
    );
}

export default function ShowcasePage() {
    const t = useTranslations("showcase");
    const [cards, setCards] = useState<ShowcaseCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch("/api/v1/showcase/cards")
            .then((res) => { if (!res.ok) throw new Error("load"); return res.json(); })
            .then((data) => { if (!cancelled) { setCards(data.cards ?? []); setFailed(false); } })
            .catch(() => { if (!cancelled) setFailed(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);

    return (
        <PageFrame title={t("title")} description={t("subtitle")}>
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : failed ? (
                <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
            ) : cards.length === 0 ? (
                <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">{t("empty")}</p></CardContent></Card>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) =>
                        card.href ? (
                            /*
                              * Named, because the whole card is the link and
                              * its picture is decorative: without this a
                              * screen reader announces a link and then reads
                              * the heading as if it were separate.
                              */
                            <Link
                                key={card.id}
                                href={card.href}
                                aria-label={card.title}
                                className="block focus-visible:outline-2"
                            >
                                <CardFace card={card} />
                            </Link>
                        ) : (
                            <CardFace key={card.id} card={card} />
                        ),
                    )}
                </div>
            )}
        </PageFrame>
    );
}
