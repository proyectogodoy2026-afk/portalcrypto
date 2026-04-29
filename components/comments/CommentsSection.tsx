"use client";

import * as React from "react";

import ScamReportButton from "@/components/scam/ScamReportButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

export default function CommentsSection({ comments }: { comments: CommentRow[] }) {
  const [nowMs, setNowMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-zinc-900">Comentarios</div>

      {comments.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Todavía no hay comentarios.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
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
