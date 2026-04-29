"use client";

import * as React from "react";

import { updateAlertSettings } from "@/app/actions/alertSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCoins } from "@/lib/api/coingecko";

type PriceAlert = {
  id: string;
  coin_id: string;
  coin_symbol: string;
  direction: "above" | "below";
  target_price: number;
  created_at: string;
  triggered_at?: string | null;
};

type Props = {
  initial: {
    notify_comment_replies: boolean;
    notify_prediction_resolved: boolean;
    notify_vote_milestone: boolean;
    notify_scam_alerts: boolean;
    followed_tokens: string[];
    followed_communities: string[];
    price_alerts: PriceAlert[];
  };
};

export default function AlertsSettingsForm({ initial }: Props) {
  const [notifyCommentReplies, setNotifyCommentReplies] = React.useState(initial.notify_comment_replies);
  const [notifyPredictionResolved, setNotifyPredictionResolved] = React.useState(initial.notify_prediction_resolved);
  const [notifyVoteMilestone, setNotifyVoteMilestone] = React.useState(initial.notify_vote_milestone);
  const [notifyScamAlerts, setNotifyScamAlerts] = React.useState(initial.notify_scam_alerts);
  const [followedTokensText, setFollowedTokensText] = React.useState(initial.followed_tokens.join(", "));
  const [followedCommunitiesText, setFollowedCommunitiesText] = React.useState(
    initial.followed_communities.join(", "),
  );
  const [priceAlerts, setPriceAlerts] = React.useState<PriceAlert[]>(initial.price_alerts);

  const [coinQuery, setCoinQuery] = React.useState("");
  const [coinResults, setCoinResults] = React.useState<Array<{ id: string; symbol: string; name: string }>>([]);
  const [selectedCoin, setSelectedCoin] = React.useState<{ id: string; symbol: string; name: string } | null>(null);
  const [newTargetPrice, setNewTargetPrice] = React.useState("");
  const [newDirection, setNewDirection] = React.useState<"above" | "below">("above");

  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = coinQuery.trim();
    if (q.length < 2) return;

    const id = window.setTimeout(async () => {
      try {
        const res = await searchCoins(q);
        setCoinResults(res.slice(0, 5).map((c) => ({ id: c.id, symbol: c.symbol, name: c.name })));
      } catch {
        setCoinResults([]);
      }
    }, 250);

    return () => window.clearTimeout(id);
  }, [coinQuery]);

  function addPriceAlert() {
    if (!selectedCoin) return;
    const target = Number(newTargetPrice);
    if (!Number.isFinite(target) || target <= 0) return;
    setPriceAlerts((current) => [
      {
        id: crypto.randomUUID(),
        coin_id: selectedCoin.id,
        coin_symbol: selectedCoin.symbol,
        direction: newDirection,
        target_price: target,
        created_at: new Date().toISOString(),
        triggered_at: null,
      },
      ...current,
    ]);
    setNewTargetPrice("");
  }

  function removeAlert(id: string) {
    setPriceAlerts((current) => current.filter((a) => a.id !== id));
  }

  function save() {
    const followedTokens = followedTokensText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const followedCommunities = followedCommunitiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await updateAlertSettings({
        notify_comment_replies: notifyCommentReplies,
        notify_prediction_resolved: notifyPredictionResolved,
        notify_vote_milestone: notifyVoteMilestone,
        notify_scam_alerts: notifyScamAlerts,
        followed_tokens: followedTokens,
        followed_communities: followedCommunities,
        price_alerts: priceAlerts,
      });

      setMessage(result.ok ? "Preferencias guardadas." : result.message);
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={notifyCommentReplies}
          onChange={(e) => setNotifyCommentReplies(e.target.checked)}
        />
        Notificarme cuando respondan mis posts
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={notifyPredictionResolved}
          onChange={(e) => setNotifyPredictionResolved(e.target.checked)}
        />
        Predicciones resueltas
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={notifyVoteMilestone}
          onChange={(e) => setNotifyVoteMilestone(e.target.checked)}
        />
        Notificarme cuando mis posts lleguen a hitos de votos
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={notifyScamAlerts}
          onChange={(e) => setNotifyScamAlerts(e.target.checked)}
        />
        Scam confirmado en tokens que sigo
      </label>

      <div className="space-y-2">
        <Label htmlFor="followed-tokens">Tokens que sigo (IDs CoinGecko, separados por coma)</Label>
        <Input
          id="followed-tokens"
          value={followedTokensText}
          onChange={(e) => setFollowedTokensText(e.target.value)}
          placeholder="bitcoin, ethereum"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="followed-communities">Comunidades que sigo (slug, separados por coma)</Label>
        <Input
          id="followed-communities"
          value={followedCommunitiesText}
          onChange={(e) => setFollowedCommunitiesText(e.target.value)}
          placeholder="bitcoin, defi, trading"
        />
      </div>

      <div className="rounded-md border border-zinc-200 p-3">
        <div className="text-sm font-medium text-zinc-900">Alertas de precio</div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <Input
            value={coinQuery}
            onChange={(e) => setCoinQuery(e.target.value)}
            placeholder="Buscar token..."
          />
          <Input
            value={selectedCoin ? `${selectedCoin.name} (${selectedCoin.symbol.toUpperCase()})` : ""}
            readOnly
            placeholder="Token seleccionado"
          />
          <Input
            type="number"
            value={newTargetPrice}
            onChange={(e) => setNewTargetPrice(e.target.value)}
            placeholder="Precio objetivo USD"
          />
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            value={newDirection}
            onChange={(e) => setNewDirection(e.target.value === "below" ? "below" : "above")}
          >
            <option value="above">Sobre</option>
            <option value="below">Bajo</option>
          </select>
        </div>

        {coinQuery.trim().length >= 2 && coinResults.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {coinResults.map((c) => (
              <button
                type="button"
                key={c.id}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
                onClick={() => setSelectedCoin(c)}
              >
                {c.name} ({c.symbol.toUpperCase()})
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3">
          <Button type="button" variant="outline" onClick={addPriceAlert}>
            Agregar alerta
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {priceAlerts.length === 0 ? (
            <div className="text-xs text-zinc-600">Sin alertas cargadas.</div>
          ) : null}
          {priceAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded border border-zinc-200 px-2 py-1">
              <div className="text-xs text-zinc-700">
                {a.coin_symbol.toUpperCase()} {a.direction === "above" ? "sobre" : "bajo"} ${a.target_price}
              </div>
              <button type="button" onClick={() => removeAlert(a.id)} className="text-xs text-red-700 hover:underline">
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Guardando..." : "Guardar alertas"}
        </Button>
        {message ? <div className="text-sm text-zinc-700">{message}</div> : null}
      </div>
    </div>
  );
}
