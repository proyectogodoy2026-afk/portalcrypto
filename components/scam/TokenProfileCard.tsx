"use client";

import * as React from "react";

import ScamReportButton from "@/components/scam/ScamReportButton";
import { cn } from "@/lib/utils/cn";
import type { TokenProfile } from "@/lib/supabase/types";

function yesNoUnknown(value: boolean | null) {
  if (value === true) return "Sí ✅";
  if (value === false) return "No ❌";
  return "Desconocido ❓";
}

function riskMeta(score: number | null) {
  if (typeof score !== "number") {
    return { dot: "bg-zinc-300", label: "Riesgo —" };
  }
  if (score >= 67) return { dot: "bg-red-500", label: "Riesgo alto 🔴" };
  if (score >= 34) return { dot: "bg-amber-500", label: "Riesgo medio 🟡" };
  return { dot: "bg-emerald-500", label: "Riesgo bajo 🟢" };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}

export default function TokenProfileCard({ token }: { token: TokenProfile }) {
  const risk = riskMeta(token.risk_score ?? null);
  const isReported = (token.report_count ?? 0) > 0 || Boolean(token.is_reported);

  const website = token.website_url?.trim() ? token.website_url.trim() : null;
  const whitepaper = token.whitepaper_url?.trim() ? token.whitepaper_url.trim() : null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">
            {token.name}{" "}
            <span className="text-xs font-normal text-zinc-500">
              ({token.symbol.toUpperCase()})
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
            <div className={cn("h-2.5 w-2.5 rounded-full", risk.dot)} />
            <span>{risk.label}</span>
          </div>
        </div>

        <ScamReportButton
          targetType="project"
          projectName={token.name}
          initialCount={token.report_count ?? 0}
        />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
        <div>
          <div className="text-xs text-zinc-500">¿Tiene producto real?</div>
          <div className="font-medium">{yesNoUnknown(token.has_real_product ?? null)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">¿Equipo público?</div>
          <div className="font-medium">{yesNoUnknown(token.team_is_public ?? null)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">¿Ha sido reportado?</div>
          <div className="font-medium">
            {isReported ? `Sí (${token.report_count ?? 0})` : "No"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Fecha de lanzamiento</div>
          <div className="font-medium">{formatDate(token.launch_date ?? null)}</div>
        </div>
      </div>

      {(website || whitepaper) ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {website ? (
            <a className="text-blue-700 underline" href={website} target="_blank" rel="noreferrer">
              Website verificado
            </a>
          ) : null}
          {whitepaper ? (
            <a
              className="text-blue-700 underline"
              href={whitepaper}
              target="_blank"
              rel="noreferrer"
            >
              Whitepaper
            </a>
          ) : null}
        </div>
      ) : null}

      {token.community_summary?.trim() ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {token.community_summary}
        </div>
      ) : null}
    </div>
  );
}

