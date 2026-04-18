"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Loader2 } from "lucide-react";

interface StaffMember {
    id: string;
    name: string;
    role: string;
    avatar: string | null;
    user: { username: string; avatar: string | null } | null;
}

export default function StaffPage() {
    const [members, setMembers] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/staff")
            .then((r) => r.json())
            .then((d) => { setMembers(d.members || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <HeroBanner />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Our Team</h1>
                    <p className="text-muted-foreground">The people behind the server</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : members.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No staff members listed</CardContent></Card>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
                        {members.map((member) => {
                            const avatarUrl = member.avatar || member.user?.avatar;
                            const initial = member.name[0].toUpperCase();

                            return (
                                <Card key={member.id} className="text-center hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                                            {avatarUrl ? (
                                                <Image src={avatarUrl} alt={member.name} width={80} height={80} className="w-full h-full object-cover" />
                                            ) : (
                                                initial
                                            )}
                                        </div>
                                        <h3 className="font-bold text-foreground">{member.name}</h3>
                                        <p className="text-sm text-blue-600 font-medium">{member.role}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
