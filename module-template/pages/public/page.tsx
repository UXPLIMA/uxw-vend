import { prisma } from "@/core/lib/db";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";

export const revalidate = 60;

async function getItems() {
    const items = await prisma.myModuleItem.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
            user: { select: { username: true, avatar: true } },
        },
    });
    return items;
}

export default async function MyModulePage() {
    const items = await getItems();

    return (
        <div className="min-h-screen flex flex-col">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="flex-1 container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6">My Module</h1>

                {items.length === 0 ? (
                    <p className="text-gray-500">No items found.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
                            >
                                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                                {item.description && (
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        {item.description}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-3">
                                    by {item.user.username}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
