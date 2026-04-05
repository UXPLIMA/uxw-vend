import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

export async function GET() {
    const articles = await prisma.blogArticle.count();
    return NextResponse.json({ stats: { articles }, sections: [] });
}
