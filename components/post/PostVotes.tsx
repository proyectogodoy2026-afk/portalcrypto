"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { castVote, type CastVoteResult } from "@/app/actions/votes";
import { useAuth } from "@/components/auth/AuthProvider";
import ScamReportButton from "@/components/scam/ScamReportButton";
import { cn } from "@/lib/utils/cn";

export type VoteType = "bullish" | "bearish";

function pct(n: number, d: number) {
  if (d <= 0) return 50;
  return Math.round((n / d) * 100);
}

function applyOptimistic(
  current: VoteType | null,
  next: VoteType,
  counts: { bullish: number; bearish: number },
) {
  const delta = { ...counts };

  if (current === next) {
    delta[next] = Math.max(0, delta[next] - 1);
    return { currentVote: null as VoteType | null, counts: delta };
  }

  if (current) {
    delta[current] = Math.max(0, delta[current] - 1);
  }
  delta[next] = delta[next] + 1;

  return { currentVote: next, counts: delta };
}

export default function PostVotes({
  postId,
  authorId,
  initialVote,
  initialCounts,
  initialScamReports,
}: {
  postId: string;
  authorId: string;
  initialVote: VoteType | null;
  initialCounts: { bullish: number; bearish: number };
  initialScamReports: number;
}) {
  const { user, profile } = useAuth();
  const [optimistic, setOptimistic] = React.useState<{
    vote: VoteType | null;
    counts: { bullish: number; bearish: number };
  } | null>(null);
  const [scamReports, setScamReports] = React.useState(initialScamReports);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const currentVote = optimistic?.vote ?? initialVote;
  const counts = optimistic?.counts ?? initialCounts;

  const isBeginner = profile?.preferred_mode === "beginner";
  const storageKey = `pc:post-vote-choice:${postId}`;
  const [beginnerChoice, setBeginnerChoice] = React.useState<
    "confianza" | "fomo" | "nerviosismo" | "miedo" | null
  >(() => {
    try {
      const raw =
        typeof window !== "undefined" ? window.sessionStorage.getItem(storageKey) : null;
      return raw === "confianza" || raw === "fomo" || raw === "nerviosismo" || raw === "miedo"
        ? raw
        : null;
    } catch {
      return null;
    }
  });

  const activeBeginnerChoice = React.useMemo(() => {
    if (!isBeginner) return null;

    const isBullChoice = beginnerChoice === "confianza" || beginnerChoice === "fomo";
    const isBearChoice = beginnerChoice === "nerviosismo" || beginnerChoice === "miedo";

    if (currentVote === "bullish") {
      return isBullChoice ? beginnerChoice : "confianza";
    }
    if (currentVote === "bearish") {
      return isBearChoice ? beginnerChoice : "nerviosismo";
    }
    return beginnerChoice;
  }, [beginnerChoice, currentVote, isBeginner]);

  const totalSentiment = counts.bullish + counts.bearish;
  const bullPct = pct(counts.bullish, totalSentiment);
  const bearPct = 100 - bullPct;

  function onVote(e: React.MouseEvent, voteType: VoteType, choice?: typeof beginnerChoice) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    if (!user) {
      setError("Necesitás iniciar sesión para votar.");
      return;
    }
    if (user.id === authorId) {
      setError("No podés votar tu propio post.");
      return;
    }

    const previousChoice = beginnerChoice;
    if (isBeginner && choice) {
      const nextChoice = currentVote === voteType ? null : choice;
      setBeginnerChoice(nextChoice);
      try {
        if (nextChoice) window.sessionStorage.setItem(storageKey, nextChoice);
        else window.sessionStorage.removeItem(storageKey);
      } catch {}
    }

    const previousOptimistic = optimistic;
    const next = applyOptimistic(currentVote, voteType, counts);
    setOptimistic({ vote: next.currentVote, counts: next.counts });

    startTransition(() => {
      void (async () => {
        let result: CastVoteResult;
        try {
          result = await castVote("post", postId, voteType);
        } catch {
          setOptimistic(previousOptimistic);
          setError("No pudimos registrar tu voto. Intentá de nuevo.");
          return;
        }

        if (!result.ok) {
          setOptimistic(previousOptimistic);
          setBeginnerChoice(previousChoice);
          setError(result.message);
          return;
        }

        setOptimistic({ vote: result.currentVote, counts: result.counts });
        if (isBeginner) {
          const next =
            result.currentVote === "bullish"
              ? (previousChoice === "confianza" || previousChoice === "fomo"
                  ? previousChoice
                  : "confianza")
              : result.currentVote === "bearish"
                ? (previousChoice === "nerviosismo" || previousChoice === "miedo"
                    ? previousChoice
                    : "nerviosismo")
                : null;
          setBeginnerChoice(next);
          try {
            if (next) window.sessionStorage.setItem(storageKey, next);
            else window.sessionStorage.removeItem(storageKey);
          } catch {}
        }
      })();
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isBeginner ? (
          <>
            <button
              type="button"
              onClick={(e) => onVote(e, "bullish", "confianza")}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                activeBeginnerChoice === "confianza"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              <ArrowUp className="h-4 w-4 text-emerald-600" />
              Confianza
            </button>

            <button
              type="button"
              onClick={(e) => onVote(e, "bullish", "fomo")}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                activeBeginnerChoice === "fomo"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              <ArrowUp className="h-4 w-4 text-emerald-600" />
              FOMO
            </button>

            <button
              type="button"
              onClick={(e) => onVote(e, "bearish", "nerviosismo")}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                activeBeginnerChoice === "nerviosismo"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              <ArrowDown className="h-4 w-4 text-red-600" />
              Nerviosismo
            </button>

            <button
              type="button"
              onClick={(e) => onVote(e, "bearish", "miedo")}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                activeBeginnerChoice === "miedo"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              <ArrowDown className="h-4 w-4 text-red-600" />
              Miedo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => onVote(e, "bullish")}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                currentVote === "bullish"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              <ArrowUp className="h-4 w-4 text-emerald-600" />
              Bullish
              <span className="tabular-nums text-xs text-zinc-600">{counts.bullish}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onVote(e, "bearish")}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                currentVote === "bearish"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              <ArrowDown className="h-4 w-4 text-red-600" />
              Bearish
              <span className="tabular-nums text-xs text-zinc-600">{counts.bearish}</span>
            </button>
          </>
        )}

        <ScamReportButton
          targetType="post"
          targetId={postId}
          initialCount={scamReports}
          onReported={(nextCount) => {
            setScamReports(nextCount);
          }}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <div className="tabular-nums">{bullPct}% {isBeginner ? "Confianza/FOMO" : "Bull"}</div>
          <div className="tabular-nums">{bearPct}% {isBeginner ? "Nerviosismo/Miedo" : "Bear"}</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className="flex h-2 w-full">
            <div className="h-2 bg-emerald-500" style={{ width: `${bullPct}%` }} />
            <div className="h-2 bg-red-500" style={{ width: `${bearPct}%` }} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
