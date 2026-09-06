"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Link } from "@/core/sdk/navigation";
import { Button } from "@/core/sdk/ui";
import { useLocalDate } from "@/core/sdk/ui";
import { ChevronRight, ChevronLeft, Newspaper } from "lucide-react";
import { SkeletonNewsGrid } from "../components/skeletons/blog-skeletons";
import { useTranslations } from "next-intl";

interface BlogPost {
  id: string;
  number: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  createdAt: string;
  category: { name: string; slug: string } | null;
}

/**
 * Room the news section holds from its first paint: two rows of cards, which
 * is what the skeleton draws and what a full page renders.
 */
const NEWS_SECTION_HEIGHT = "min-h-[532px]";

export function BlogNewsSection() {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const t = useTranslations('news');
    const formatLocalDate = useLocalDate();

  useEffect(() => {
    fetch('/api/v1/blog/articles?limit=8')
      .then(res => res.json())
      .then(data => { setBlogPosts(data.articles || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  // Two pages out of the eight articles fetched above. This read the
  // `per_page_home_news` setting, which no manifest declares and no screen
  // writes, so the fallback was the only value it ever had.
  const newsPerPage = 4;
  const totalPages = Math.ceil(blogPosts.length / newsPerPage);
  const paginatedNews = blogPosts.slice((currentPage - 1) * newsPerPage, currentPage * newsPerPage);

  // The skeleton stands in for two rows of cards, so a shorter answer after
  // it shortens the page and pulls the footer up. That was 0.154 of layout
  // shift against a 0.1 budget, and all of it landed after the reader had
  // started looking. Every state reserves the same room now, so the section
  // keeps the height it asked for whatever arrives.
  if (isLoading) return <div className={NEWS_SECTION_HEIGHT}><SkeletonNewsGrid count={4} /></div>;
  // Don't return null when empty - render a visible empty state so the
  // homepage doesn't appear blank when blog is the only enabled section
  // and there's no published content yet.
  if (blogPosts.length === 0) {
    return (
      <div className={`${NEWS_SECTION_HEIGHT} flex flex-col items-center justify-center bg-card border border-dashed border-border rounded-lg py-10 px-6 text-center`}>
        <Newspaper className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <h2 className="font-medium text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className={NEWS_SECTION_HEIGHT}>
      <h2 className="text-xl font-bold text-foreground mb-6">{t('title')}</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {paginatedNews.map((post) => (
          <Link key={post.id} href={`/blog/${post.number}/${post.slug}`}
            className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-all group">
            <div className="h-44 bg-muted flex items-center justify-center overflow-hidden">
              {post.coverImage ? (
                <Image src={post.coverImage} alt={post.title} width={0} height={0} sizes="100vw" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="text-muted-foreground text-sm">{t('noImage')}</div>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                {formatLocalDate(post.publishedAt || post.createdAt)}
              </p>
              <h3 className="font-semibold text-foreground mb-1 line-clamp-2">{post.title}</h3>
              {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>}
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="w-4 h-4" /> {t('previous')}
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(page)}>
              {page}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
            {t('next')} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default BlogNewsSection;
