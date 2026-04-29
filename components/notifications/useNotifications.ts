"use client";

import * as React from "react";

import type { Notification } from "@/lib/supabase/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UseNotificationsResult = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

export function useNotifications(userId: string | null): UseNotificationsResult {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const unreadCount = React.useMemo(() => {
    return notifications.reduce((acc, n) => acc + (n.is_read ? 0 : 1), 0);
  }, [notifications]);

  React.useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const uid = userId;

    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("id,user_id,type,title,body,link,is_read,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!isMounted) return;
      setNotifications((data ?? []) as unknown as Notification[]);
    }

    void load();

    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          setNotifications((current) => {
            const next = [...current];

            if (payload.eventType === "INSERT") {
              const row = payload.new as unknown as Notification;
              return [row, ...next].slice(0, 10);
            }

            if (payload.eventType === "UPDATE") {
              const row = payload.new as unknown as Notification;
              const idx = next.findIndex((n) => n.id === row.id);
              if (idx >= 0) next[idx] = row;
              return next;
            }

            if (payload.eventType === "DELETE") {
              const row = payload.old as unknown as { id?: string };
              return next.filter((n) => n.id !== row.id);
            }

            return next;
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const markAsRead = React.useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      setNotifications((current) =>
        current.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
      );
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);
    },
    [supabase, userId],
  );

  const markAllAsRead = React.useCallback(async () => {
    if (!userId) return;
    setNotifications((current) => current.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
  }, [supabase, userId]);

  const visibleNotifications = userId ? notifications : [];
  const visibleUnread = userId ? unreadCount : 0;

  return {
    notifications: visibleNotifications,
    unreadCount: visibleUnread,
    markAsRead,
    markAllAsRead,
  };
}
