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

type ScrapeSource = {
  id: string;
  name: string;
  url: string;
  list_container_selector: string;
  link_selector: string;
  content_selector: string;
  ignore_selector: string | null;
  is_active: boolean;
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
  const [sourceDraft, setSourceDraft] = React.useState({
    name: "",
    url: "",
    list_container_selector: "",
    link_selector: "",
    content_selector: "",
    ignore_selector: "",
    is_active: true,
  });
  const [pending, startTransition] = React.useTransition();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const usersSWR = useSWR<{ users: AdminUser[] }>("/api/admin/users", fetchJson);
  const communitiesSWR = useSWR<{ communities: CommunityRow[] }>(
    "/api/admin/communities",
    fetchJson,
  );
  const sourcesSWR = useSWR<{ sources: ScrapeSource[] }>(
    "/api/admin/scrape-sources",
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

  const sources = React.useMemo(
    () => sourcesSWR.data?.sources ?? [],
    [sourcesSWR.data?.sources],
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

  function createSource() {
    setActionError(null);
    startTransition(() => {
      void (async () => {
        const payload = {
          name: sourceDraft.name.trim(),
          url: sourceDraft.url.trim(),
          list_container_selector: sourceDraft.list_container_selector.trim(),
          link_selector: sourceDraft.link_selector.trim(),
          content_selector: sourceDraft.content_selector.trim(),
          ignore_selector: sourceDraft.ignore_selector.trim() || null,
          is_active: Boolean(sourceDraft.is_active),
        };
        const res = await fetch("/api/admin/scrape-sources", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setActionError(data?.message ?? "No pudimos guardar la fuente.");
          return;
        }
        setSourceDraft({
          name: "",
          url: "",
          list_container_selector: "",
          link_selector: "",
          content_selector: "",
          ignore_selector: "",
          is_active: true,
        });
        await sourcesSWR.mutate();
      })();
    });
  }

  function updateSource(id: string, patch: Partial<ScrapeSource>) {
    setActionError(null);
    startTransition(() => {
      void (async () => {
        const res = await fetch(`/api/admin/scrape-sources/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setActionError(data?.message ?? "No pudimos actualizar la fuente.");
          return;
        }
        await sourcesSWR.mutate();
      })();
    });
  }

  function deleteSource(id: string, label: string) {
    const ok = window.confirm(`Eliminar fuente "${label}"?`);
    if (!ok) return;
    setActionError(null);
    startTransition(() => {
      void (async () => {
        const res = await fetch(`/api/admin/scrape-sources/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setActionError(data?.message ?? "No pudimos eliminar la fuente.");
          return;
        }
        await sourcesSWR.mutate();
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
        <div>
          <div className="text-sm font-semibold text-zinc-900">Scrapping · Fuentes</div>
          <div className="mt-1 text-xs text-zinc-600">
            Cada fuente define selectores CSS para encontrar la lista de posts, el link al post y el
            contenedor del contenido. Ignorar sirve para remover bloques no deseados.
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={sourceDraft.name}
            onChange={(e) => setSourceDraft((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nombre (ej: El Mundo)"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
          <input
            value={sourceDraft.url}
            onChange={(e) => setSourceDraft((p) => ({ ...p, url: e.target.value }))}
            placeholder="URL (https://...)"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
          <input
            value={sourceDraft.list_container_selector}
            onChange={(e) => setSourceDraft((p) => ({ ...p, list_container_selector: e.target.value }))}
            placeholder="Selector lista (ej: .news-list)"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
          <input
            value={sourceDraft.link_selector}
            onChange={(e) => setSourceDraft((p) => ({ ...p, link_selector: e.target.value }))}
            placeholder="Selector link (ej: a.headline)"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
          <input
            value={sourceDraft.content_selector}
            onChange={(e) => setSourceDraft((p) => ({ ...p, content_selector: e.target.value }))}
            placeholder="Selector contenido (ej: article .content)"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
          <input
            value={sourceDraft.ignore_selector}
            onChange={(e) => setSourceDraft((p) => ({ ...p, ignore_selector: e.target.value }))}
            placeholder="Selector ignorar (opcional)"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={sourceDraft.is_active}
              onChange={(e) => setSourceDraft((p) => ({ ...p, is_active: e.target.checked }))}
            />
            Activa
          </label>
          <div className="flex justify-end md:justify-start">
            <Button
              type="button"
              disabled={
                pending ||
                !sourceDraft.name.trim() ||
                !sourceDraft.url.trim() ||
                !sourceDraft.list_container_selector.trim() ||
                !sourceDraft.link_selector.trim() ||
                !sourceDraft.content_selector.trim()
              }
              onClick={createSource}
            >
              Guardar fuente
            </Button>
          </div>
        </div>

        {sourcesSWR.error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {String(sourcesSWR.error?.message ?? "Error")}
          </div>
        ) : sourcesSWR.isLoading ? (
          <div className="mt-4 text-sm text-zinc-600">Cargando…</div>
        ) : sources.length === 0 ? (
          <div className="mt-4 text-sm text-zinc-600">Todavía no hay fuentes.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {sources.map((s) => (
              <div key={s.id} className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900">{s.name}</div>
                    <div className="mt-1 truncate text-xs text-zinc-600">{s.url}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={s.is_active}
                        disabled={pending}
                        onChange={(e) => updateSource(s.id, { is_active: e.target.checked })}
                      />
                      Activa
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => deleteSource(s.id, s.name)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input
                    defaultValue={s.list_container_selector}
                    onBlur={(e) =>
                      updateSource(s.id, { list_container_selector: e.target.value.trim() })
                    }
                    placeholder="Selector lista"
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  />
                  <input
                    defaultValue={s.link_selector}
                    onBlur={(e) => updateSource(s.id, { link_selector: e.target.value.trim() })}
                    placeholder="Selector link"
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  />
                  <input
                    defaultValue={s.content_selector}
                    onBlur={(e) => updateSource(s.id, { content_selector: e.target.value.trim() })}
                    placeholder="Selector contenido"
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  />
                  <input
                    defaultValue={s.ignore_selector ?? ""}
                    onBlur={(e) =>
                      updateSource(s.id, { ignore_selector: e.target.value.trim() || null })
                    }
                    placeholder="Selector ignorar (opcional)"
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  />
                </div>
              </div>
            ))}
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
