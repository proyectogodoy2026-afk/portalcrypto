"use client";

import * as React from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  username: string | null;
  is_admin: boolean;
  is_moderator: boolean;
};

type CommunityRow = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  member_count: number | null;
  risk_level: string | null;
  status: string | null;
  requested_reason: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewed_note: string | null;
  created_at: string | null;
};

async function fetchJson<T>(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Error al cargar");
  }
  return (await res.json()) as T;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}

export default function AdminDashboard({ superEmail }: { superEmail: string }) {
  const [userQuery, setUserQuery] = React.useState("");
  const [communityQuery, setCommunityQuery] = React.useState("");
  const [reviewNotes, setReviewNotes] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const usersSWR = useSWR<{ users: AdminUser[] }>("/api/admin/users", fetchJson);
  const communitiesSWR = useSWR<{ communities: CommunityRow[] }>(
    "/api/admin/communities",
    fetchJson,
  );

  const users = React.useMemo(() => usersSWR.data?.users ?? [], [usersSWR.data?.users]);
  const communities = React.useMemo(
    () => communitiesSWR.data?.communities ?? [],
    [communitiesSWR.data?.communities],
  );

  const filteredUsers = React.useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      const username = (u.username ?? "").toLowerCase();
      return email.includes(q) || username.includes(q) || u.id.toLowerCase().includes(q);
    });
  }, [userQuery, users]);

  const filteredCommunities = React.useMemo(() => {
    const q = communityQuery.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.type ?? "").toLowerCase().includes(q)
      );
    });
  }, [communities, communityQuery]);

  const pendingRequests = React.useMemo(
    () => communities.filter((c) => (c.status ?? "").toLowerCase() === "pending"),
    [communities],
  );

  function setAdminRole(userId: string, value: boolean) {
    setActionError(null);
    startTransition(() => {
      void (async () => {
        const res = await fetch("/api/admin/users/role", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId, is_admin: value }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setActionError(data?.message ?? "No pudimos actualizar el rol.");
          return;
        }
        await usersSWR.mutate();
      })();
    });
  }

  function deleteCommunity(communityId: string, label: string) {
    const ok = window.confirm(
      `Eliminar comunidad "${label}"?\n\nEsto elimina también posts, comentarios y votos asociados.`,
    );
    if (!ok) return;

    setActionError(null);
    startTransition(() => {
      void (async () => {
        const res = await fetch("/api/admin/communities/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ communityId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setActionError(data?.message ?? "No pudimos eliminar la comunidad.");
          return;
        }
        await communitiesSWR.mutate();
      })();
    });
  }

  function reviewCommunity(communityId: string, status: "approved" | "rejected") {
    setActionError(null);
    startTransition(() => {
      void (async () => {
        const res = await fetch("/api/admin/communities/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            communityId,
            status,
            note: (reviewNotes[communityId] ?? "").trim() || null,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setActionError(data?.message ?? "No pudimos actualizar la comunidad.");
          return;
        }
        setReviewNotes((prev) => {
          const next = { ...prev };
          delete next[communityId];
          return next;
        });
        await communitiesSWR.mutate();
      })();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Admin</h1>
        <div className="mt-1 text-sm text-zinc-600">
          Gestión de accesos y moderación de comunidades.
        </div>
      </div>

      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Usuarios</div>
            <div className="mt-1 text-xs text-zinc-600">
              El super admin ({superEmail}) siempre tiene acceso. A otros usuarios se les concede
              acceso activando is_admin en profiles.
            </div>
          </div>
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Buscar por email, username o id…"
            className="h-10 w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
        </div>

        {usersSWR.error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {String(usersSWR.error?.message ?? "Error")}
          </div>
        ) : usersSWR.isLoading ? (
          <div className="mt-4 text-sm text-zinc-600">Cargando…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="mt-4 text-sm text-zinc-600">No hay resultados.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
            <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
              <div className="col-span-5">Email</div>
              <div className="col-span-3">Username</div>
              <div className="col-span-2">Alta</div>
              <div className="col-span-2 text-right">Acción</div>
            </div>
            <div className="divide-y divide-zinc-200">
              {filteredUsers.map((u) => {
                const email = (u.email ?? "").toLowerCase();
                const isSuper = email === superEmail.toLowerCase();
                return (
                  <div key={u.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                    <div className="col-span-5 min-w-0 truncate text-sm text-zinc-900">
                      {u.email ?? "—"}
                    </div>
                    <div className="col-span-3 min-w-0 truncate text-sm text-zinc-700">
                      {u.username ?? "—"}
                    </div>
                    <div className="col-span-2 text-sm text-zinc-700">{formatDate(u.created_at)}</div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant={u.is_admin ? "outline" : "default"}
                        disabled={pending || isSuper}
                        onClick={() => setAdminRole(u.id, !u.is_admin)}
                      >
                        {u.is_admin ? "Quitar" : "Dar"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Comunidades</div>
            <div className="mt-1 text-xs text-zinc-600">
              Eliminación dura: borra comunidad y sus posts/comentarios/votos asociados.
            </div>
          </div>
          <input
            value={communityQuery}
            onChange={(e) => setCommunityQuery(e.target.value)}
            placeholder="Buscar por nombre, slug o tipo…"
            className="h-10 w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
        </div>

        {communitiesSWR.error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {String(communitiesSWR.error?.message ?? "Error")}
          </div>
        ) : communitiesSWR.isLoading ? (
          <div className="mt-4 text-sm text-zinc-600">Cargando…</div>
        ) : (
          <div className="mt-4 space-y-4">
            {pendingRequests.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-zinc-900">Solicitudes pendientes</div>
                {pendingRequests.map((c) => (
                  <div key={c.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-900">
                          {c.name} · /c/{c.slug}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Tipo {c.type ?? "—"} · Solicitado {formatDate(c.created_at)}
                        </div>
                        <div className="mt-2 text-sm text-zinc-800">
                          <span className="font-medium">Razón:</span>{" "}
                          {c.requested_reason?.trim() ? c.requested_reason : "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={pending}
                          onClick={() => reviewCommunity(c.id, "approved")}
                        >
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => reviewCommunity(c.id, "rejected")}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </div>
                    <input
                      value={reviewNotes[c.id] ?? ""}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="Nota para el usuario (opcional)…"
                      className="mt-3 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {filteredCommunities.length === 0 ? (
              <div className="text-sm text-zinc-600">No hay resultados.</div>
            ) : (
              <div className="overflow-hidden rounded-md border border-zinc-200">
                <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
                  <div className="col-span-4">Nombre</div>
                  <div className="col-span-3">Slug</div>
                  <div className="col-span-2">Tipo</div>
                  <div className="col-span-1">Estado</div>
                  <div className="col-span-1 text-right">Miembros</div>
                  <div className="col-span-2 text-right">Acción</div>
                </div>
                <div className="divide-y divide-zinc-200">
                  {filteredCommunities.map((c) => (
                    <div key={c.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                      <div className="col-span-4 min-w-0 truncate text-sm text-zinc-900">
                        {c.name}
                      </div>
                      <div className="col-span-3 min-w-0 truncate text-sm text-zinc-700">
                        /c/{c.slug}
                      </div>
                      <div className="col-span-2 text-sm text-zinc-700">{c.type ?? "—"}</div>
                      <div className="col-span-1 text-xs text-zinc-600">
                        {(c.status ?? "—").toString()}
                      </div>
                      <div className="col-span-1 text-right text-sm text-zinc-700">
                        {(c.member_count ?? 0).toLocaleString()}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => deleteCommunity(c.id, c.name)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
