"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";

import { Button } from "@/components/ui/button";

async function fetchJson<T>(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Error al cargar");
  }
  return (await res.json()) as T;
}

type MembershipState = { joined: boolean; memberCount: number };

export default function CommunityActions({ communityId }: { communityId: string }) {
  const swr = useSWR<MembershipState>(
    `/api/communities/membership?communityId=${encodeURIComponent(communityId)}`,
    fetchJson,
  );

  const [pending, startTransition] = React.useTransition();

  const joined = swr.data?.joined ?? false;

  function toggleJoin(next: "join" | "leave") {
    startTransition(() => {
      void (async () => {
        const res = await fetch("/api/communities/membership", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ communityId, action: next }),
        });
        if (!res.ok) return;
        await swr.mutate();
      })();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={joined ? "outline" : "default"}
        disabled={pending || swr.isLoading}
        onClick={() => toggleJoin(joined ? "leave" : "join")}
      >
        {joined ? "Salir" : "Unirse"}
      </Button>

      <Button type="button" disabled={!joined} asChild={joined}>
        {joined ? (
          <Link href={`/post/new?community=${encodeURIComponent(communityId)}`}>Crear post</Link>
        ) : (
          <span>Unite para postear</span>
        )}
      </Button>
    </div>
  );
}

