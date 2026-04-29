"use client";

import * as React from "react";
import Link from "next/link";

import PostPriceHeader from "@/components/market/PostPriceHeader";
import PostVotes, { type VoteType } from "@/components/post/PostVotes";
import GlossaryTerm from "@/components/glossary/GlossaryTerm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GLOSSARY } from "@/lib/glossary";
import { cn } from "@/lib/utils/cn";

export type FeedPost = {
  id: string;
  author_id: string;
  community_id: string;
  title: string;
  content?: string | null;
  tag: string | null;
  type: string | null;
  risk_indicator: string | null;
  what_happened?: string | null;
  why_it_matters?: string | null;
  who_is_affected?: string | null;
  bullish_votes: number | null;
  bearish_votes: number | null;
  scam_reports: number | null;
  is_flagged?: boolean | null;
  user_vote?: VoteType | null;
  comment_count: number | null;
  anchored_coin_id: string | null;
  price_at_post?: number | null;
  created_at: string | null;
  profiles?: { username: string | null; avatar_url: string | null } | null;
  communities?: { name: string; slug: string; risk_level?: string | null } | null;
};

function timeAgo(value: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

function riskColor(value: string | null) {
  if (value === "bajo" || value === "low") return "bg-emerald-500";
  if (value === "medio" || value === "medium") return "bg-amber-500";
  if (value === "alto" || value === "high") return "bg-red-500";
  return "bg-zinc-300";
}

function getInitials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 2).toUpperCase();
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function simpleSummary(value: string) {
  const cleaned = stripMarkdown(value);
  if (!cleaned) return "";
  const first = cleaned.split(/[.!?]\s/)[0] ?? cleaned;
  const short = first.length > 220 ? `${first.slice(0, 220).trim()}…` : first;
  return short;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function PostCard({
  post,
  disableLink,
  hideMarketData,
}: {
  post: FeedPost;
  disableLink?: boolean;
  hideMarketData?: boolean;
}) {
  const author = normalizeOne(post.profiles);
  const community = normalizeOne(post.communities);

  const tag = post.tag?.trim() ? post.tag : null;
  const [simple, setSimple] = React.useState(false);

  const terms = React.useMemo(
    () =>
      Object.keys(GLOSSARY).sort((a, b) => b.length - a.length),
    [],
  );
  const glossaryRegex = React.useMemo(() => {
    const pattern = terms.map(escapeRegex).join("|");
    return pattern ? new RegExp(`(${pattern})`, "g") : null;
  }, [terms]);

  function renderWithGlossary(text: string) {
    if (!glossaryRegex) return text;
    const parts = text.split(glossaryRegex);
    return parts.map((p, idx) => {
      const def = (GLOSSARY as Record<string, string>)[p];
      if (!def) return <React.Fragment key={idx}>{p}</React.Fragment>;
      return <GlossaryTerm key={idx} term={p} definition={def} />;
    });
  }

  const content = (
    <>
      {post.is_flagged || (post.scam_reports ?? 0) >= 3 ? (
        <div className="mb-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ⚠️ Este contenido ha sido marcado por la comunidad como posible riesgo. Procede con cuidado.
          </div>
        </div>
      ) : null}
      {post.anchored_coin_id && !hideMarketData ? (
        <PostPriceHeader
          coinId={post.anchored_coin_id}
          symbol={null}
          priceAtPost={post.price_at_post ?? null}
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={author?.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{getInitials(author?.username ?? "?")}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-zinc-700">
                {author?.username ?? "Anónimo"}
              </span>
            </div>
            <span>·</span>
            {community ? (
              <span className="font-medium text-zinc-700">/c/{community.slug}</span>
            ) : (
              <span className="font-medium text-zinc-700">Comunidad</span>
            )}
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
            {tag ? (
              <>
                <span>·</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                  {tag}
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900">
            {post.title}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
            <div>{post.comment_count ?? 0} comentarios</div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSimple((v) => !v);
              }}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 hover:bg-zinc-50"
            >
              Explícamelo simple
            </button>
          </div>

          {simple ? (
            <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
              {post.what_happened?.trim() || post.why_it_matters?.trim() ? (
                <div className="space-y-2">
                  {post.what_happened?.trim() ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Qué pasó</div>
                      <div className="text-sm">{renderWithGlossary(post.what_happened.trim())}</div>
                    </div>
                  ) : null}
                  {post.why_it_matters?.trim() ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Por qué importa</div>
                      <div className="text-sm">{renderWithGlossary(post.why_it_matters.trim())}</div>
                    </div>
                  ) : null}
                  {post.who_is_affected?.trim() ? (
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">A quién afecta</div>
                      <div className="text-sm">{renderWithGlossary(post.who_is_affected.trim())}</div>
                    </div>
                  ) : null}
                </div>
              ) : post.content?.trim() ? (
                <div className="text-sm">{renderWithGlossary(simpleSummary(post.content))}</div>
              ) : (
                <div className="text-sm text-zinc-600">No hay más detalles para simplificar.</div>
              )}
            </div>
          ) : null}

          <PostVotes
            postId={post.id}
            authorId={post.author_id}
            initialVote={post.user_vote ?? null}
            initialCounts={{
              bullish: post.bullish_votes ?? 0,
              bearish: post.bearish_votes ?? 0,
            }}
            initialScamReports={post.scam_reports ?? 0}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <div className={cn("h-2.5 w-2.5 rounded-full", riskColor(post.risk_indicator))} />
            <span className="capitalize">{post.risk_indicator ?? "—"}</span>
          </div>
        </div>
      </div>
    </>
  );

  if (disableLink) {
    return <div className="block rounded-lg border border-zinc-200 bg-white p-4">{content}</div>;
  }

  return (
    <Link
      href={`/post/${post.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
    >
      {content}
    </Link>
  );
}
