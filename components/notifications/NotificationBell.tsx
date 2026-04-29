"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, MessageCircleReply, TrendingUp, Trophy } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useNotifications } from "@/components/notifications/useNotifications";

function relativeTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

function notificationIcon(type: string) {
  if (type === "comment_reply") return <MessageCircleReply className="h-3.5 w-3.5 text-blue-600" />;
  if (type === "prediction_resolved") return <Trophy className="h-3.5 w-3.5 text-emerald-600" />;
  if (type === "vote_milestone") return <TrendingUp className="h-3.5 w-3.5 text-violet-600" />;
  if (type === "scam_alert") return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
  if (type === "price_alert") return <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />;
  return <Bell className="h-3.5 w-3.5 text-zinc-600" />;
}

export default function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id ?? null);

  React.useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function tick() {
      try {
        await fetch("/api/alerts/check", { method: "POST" });
      } catch {
      } finally {
        if (!cancelled) window.setTimeout(tick, 120_000);
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white hover:bg-zinc-50",
            className,
          )}
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4 text-zinc-900" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="text-sm font-medium text-zinc-900">Notificaciones</div>
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            Marcar todo como leído
          </button>
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-3 py-3 text-sm text-zinc-600">Todavía no tenés notificaciones.</div>
        ) : null}

        {notifications.map((n) => (
          <DropdownMenuItem key={n.id} className="items-start gap-2">
            <span className="mt-1">{notificationIcon(n.type)}</span>
            <Link
              href={n.link ?? "/"}
              className="flex w-full flex-col gap-0.5"
              onClick={() => void markAsRead(n.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn("text-sm text-zinc-900", n.is_read ? "font-normal" : "font-semibold")}>
                  {n.title}
                </div>
                <div className="shrink-0 text-[11px] text-zinc-500">{relativeTime(n.created_at ?? null)}</div>
              </div>
              {n.body?.trim() ? <div className="text-xs text-zinc-600">{n.body}</div> : null}
            </Link>
            {!n.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
