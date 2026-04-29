"use client";

import * as React from "react";
import useSWRInfinite from "swr/infinite";

import PostCard, { type FeedPost } from "@/components/post/PostCard";
import { Button } from "@/components/ui/button";

type FeedOrder = "recent" | "trending" | "bull" | "bear";

type FeedResponse = {
  posts: FeedPost[];
  nextOffset: number | null;
};

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.message ?? "Error al cargar");
  }
  return (await res.json()) as FeedResponse;
}

const PAGE_SIZE = 20;

export default function Feed({
  initialPosts,
  communitySlug,
}: {
  initialPosts: FeedPost[];
  communitySlug?: string | null;
}) {
  const [order, setOrder] = React.useState<FeedOrder>("recent");

  const getKey = React.useCallback(
    (pageIndex: number, previousPageData: FeedResponse | null) => {
      if (previousPageData && previousPageData.nextOffset === null) return null;

      const offset =
        pageIndex === 0
          ? 0
          : previousPageData?.nextOffset ?? pageIndex * PAGE_SIZE;

      const params = new URLSearchParams();
      params.set("order", order);
      params.set("offset", String(offset));
      if (communitySlug) params.set("community", communitySlug);

      return `/api/feed?${params.toString()}`;
    },
    [communitySlug, order],
  );

  const fallback: FeedResponse = React.useMemo(
    () => ({
      posts: initialPosts,
      nextOffset: initialPosts.length === PAGE_SIZE ? PAGE_SIZE : null,
    }),
    [initialPosts],
  );

  const { data, error, setSize, isValidating } = useSWRInfinite<FeedResponse>(
    getKey,
    fetcher,
    { fallbackData: [fallback] },
  );

  React.useEffect(() => {
    setSize(1);
  }, [order, setSize]);

  const pages = data ?? [];
  const posts = pages.flatMap((p) => p.posts ?? []);
  const nextOffset = pages.length ? pages[pages.length - 1]?.nextOffset ?? null : null;
  const hasMore = nextOffset !== null;

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (!hasMore) return;
      if (isValidating) return;
      void setSize((s) => s + 1);
    });

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isValidating, setSize]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={order === "recent" ? "default" : "outline"}
          onClick={() => setOrder("recent")}
        >
          Reciente
        </Button>
        <Button
          type="button"
          variant={order === "trending" ? "default" : "outline"}
          onClick={() => setOrder("trending")}
        >
          Trending
        </Button>
        <Button
          type="button"
          variant={order === "bull" ? "default" : "outline"}
          onClick={() => setOrder("bull")}
        >
          Solo Bull
        </Button>
        <Button
          type="button"
          variant={order === "bear" ? "default" : "outline"}
          onClick={() => setOrder("bear")}
        >
          Solo Bear
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No pudimos cargar el feed. Intentá de nuevo.
        </div>
      ) : null}

      {posts.length === 0 && !isValidating ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No hay posts todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} />

      <div className="text-center text-xs text-zinc-500">
        {isValidating ? "Cargando..." : hasMore ? "Deslizá para cargar más" : "Fin del feed"}
      </div>
    </div>
  );
}
