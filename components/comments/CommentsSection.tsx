"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
  comments,
  variant = "page",
}: {
  postId: string;
  comments: CommentRow[];
  variant?: "page" | "inline";
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile } = useAuth();

  const [nowMs, setNowMs] = React.useState<number | null>(null);
  const [items, setItems] = React.useState<CommentRow[]>(comments);
  const [loading, setLoading] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (variant === "page") {
      setItems(comments);
    }
  }, [comments, variant]);

  React.useEffect(() => {
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(id);
    };
  }, []);

  const loadComments = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("comments")
      .select("id,author_id,content,created_at,profiles ( username, avatar_url )")
      .eq("post_id", postId)
      .neq("is_removed", true)
      .order("created_at", { ascending: true, nullsFirst: false })
      .limit(100);

    setLoading(false);

    if (fetchError) {
      setError(`No pudimos cargar los comentarios: ${fetchError.message}`);
      return;
    }

    setItems((data ?? []) as unknown as CommentRow[]);
  }, [postId, supabase]);

  React.useEffect(() => {
    if (variant !== "inline") return;
    void loadComments();
  }, [loadComments, variant]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (!trimmed) return;
    if (!user) {
      setError("Necesitás iniciar sesión para comentar.");
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
    setItems((prev) => [...prev, optimistic]);
    setContent("");

    const { error: insertError } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: user.id,
      content: trimmed,
    } as never);

    setSubmitting(false);

    if (insertError) {
      setItems((prev) => prev.filter((c) => c.id !== optimistic.id));
      const msg = (insertError.message ?? "").toLowerCase();
      if (msg.includes("row-level security") || msg.includes("permission denied")) {
        setError("No pudimos guardar tu comentario por permisos (RLS) en la tabla comments.");
      } else {
        setError(`No pudimos guardar tu comentario: ${insertError.message}`);
      }
      return;
    }

    if (variant === "page") {
      router.refresh();
    } else {
      await loadComments();
    }
  }

  return (
    <div className="space-y-4" id="comments">
      <div className="text-sm font-semibold text-zinc-900">Comentarios</div>

      <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={user ? "Escribí tu comentario..." : "Iniciá sesión para comentar."}
          disabled={!user || submitting}
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
