"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import ScamReportButton from "@/components/scam/ScamReportButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CommentRow = {
  id: string;
  author_id: string | null;
  content: string;
  created_at: string | null;
  profiles?: { username: string | null; avatar_url: string | null } | null;
};

export type { CommentRow };

async function fetchJson<T>(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Error al cargar");
  }
  return (await res.json()) as T;
}

function getInitials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 2).toUpperCase();
}

function timeAgoAt(value: string | null, nowMs: number | null) {
  if (!value) return "—";
  if (!nowMs) return "—";
  const ms = nowMs - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

export default function CommentsSection({
  postId,
  communityId,
  comments,
  variant = "page",
  onCountChange,
}: {
  postId: string;
  communityId: string;
  comments: CommentRow[];
  variant?: "page" | "inline";
  onCountChange?: (count: number) => void;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile } = useAuth();

  const [nowMs, setNowMs] = React.useState<number | null>(null);
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(id);
    };
  }, []);

  const loadInline = React.useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("comments")
      .select("id,author_id,content,created_at,profiles ( username, avatar_url )")
      .eq("post_id", postId)
      .neq("is_removed", true)
      .order("created_at", { ascending: true, nullsFirst: false })
      .limit(100);

    if (fetchError) {
      throw new Error(fetchError.message ?? "No pudimos cargar los comentarios.");
    }

    return (data ?? []) as unknown as CommentRow[];
  }, [postId, supabase]);

  const inlineSWR = useSWR<CommentRow[]>(
    variant === "inline" ? ["comments", postId] : null,
    loadInline,
  );

  const items = variant === "page" ? comments : inlineSWR.data ?? [];
  const loading = variant === "inline" ? inlineSWR.isLoading : false;
  const fetchErrorMessage =
    variant === "inline" ? (inlineSWR.error as Error | undefined)?.message ?? null : null;

  const membershipSWR = useSWR<{ joined: boolean; memberCount: number }>(
    user ? `/api/communities/membership?communityId=${encodeURIComponent(communityId)}` : null,
    fetchJson,
  );
  const joined = membershipSWR.data?.joined ?? false;

  React.useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (!trimmed) return;
    if (!user) {
      setError("Necesitás iniciar sesión para comentar.");
      return;
    }
    if (!joined) {
      setError("Tenés que unirte a la comunidad para comentar.");
      return;
    }

    setSubmitting(true);

    const optimistic: CommentRow = {
      id: crypto.randomUUID(),
      author_id: user.id,
      content: trimmed,
      created_at: new Date().toISOString(),
      profiles: { username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null },
    };

    if (variant === "inline") {
      inlineSWR.mutate([...(inlineSWR.data ?? []), optimistic], { revalidate: false });
    }

    setContent("");

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, content: trimmed }),
    });
    const data = await res.json().catch(() => null);

    setSubmitting(false);

    if (!res.ok) {
      if (variant === "inline") {
        inlineSWR.mutate(
          (current) => (current ?? []).filter((c) => c.id !== optimistic.id),
          { revalidate: false },
        );
      }
      setError(data?.message ?? "No pudimos guardar tu comentario.");
      return;
    }

    if (variant === "page") {
      router.refresh();
    } else {
      await inlineSWR.mutate();
    }
  }

  return (
    <div className="space-y-4" id="comments">
      <div className="text-sm font-semibold text-zinc-900">Comentarios</div>

      <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
        {user && !membershipSWR.isLoading && !joined ? (
          <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
            Unite a la comunidad para poder comentar.
            <div className="mt-2">
              <Button
                type="button"
                onClick={async () => {
                  setError(null);
                  const res = await fetch("/api/communities/membership", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ communityId, action: "join" }),
                  });
                  if (!res.ok) return;
                  await membershipSWR.mutate();
                }}
              >
                Unirse
              </Button>
            </div>
          </div>
        ) : null}
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            !user
              ? "Iniciá sesión para comentar."
              : !joined
                ? "Unite a la comunidad para comentar."
                : "Escribí tu comentario..."
          }
          disabled={!user || submitting || (user && !joined)}
        />
        <div className="mt-3 flex items-center justify-end">
          <Button type="submit" disabled={!user || submitting || !content.trim()}>
            {submitting ? "Publicando..." : "Comentar"}
          </Button>
        </div>
        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </form>

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Cargando comentarios…
        </div>
      ) : fetchErrorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {fetchErrorMessage}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Todavía no hay comentarios.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.profiles?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>
                      {getInitials(c.profiles?.username ?? "—")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {c.profiles?.username ?? "Anónimo"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {timeAgoAt(c.created_at, nowMs)}
                    </div>
                  </div>
                </div>

                <ScamReportButton targetType="comment" targetId={c.id} />
              </div>

              <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">
                {c.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
