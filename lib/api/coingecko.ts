export const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

type CacheEntry = { data: unknown; timestamp: number };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function getCacheKey(path: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  return `${method}:${path}`;
}

export async function coingeckoFetch(path: string, init?: RequestInit) {
  const key = getCacheKey(path, init);
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && now - existing.timestamp < TTL_MS) {
    return existing.data;
  }

  const url = new URL(path.replace(/^\//, ""), COINGECKO_BASE_URL + "/");
  const res = await fetch(url, { ...init, next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error("Error al consultar CoinGecko");
  }
  const data = (await res.json()) as unknown;
  cache.set(key, { data, timestamp: now });
  return data;
}

export interface CoinPrice {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] };
}

export type SearchResult = {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
};

type CoinsMarketsResponse = Array<
  Partial<{
    id: string;
    symbol: string;
    current_price: number;
    price_change_percentage_1h_in_currency: number;
    price_change_percentage_24h: number;
    price_change_percentage_24h_in_currency: number;
    price_change_percentage_7d_in_currency: number;
    market_cap: number;
    total_volume: number;
    sparkline_in_7d: { price: number[] };
  }>
>;

type SearchResponse = {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    thumb: string;
  }>;
};

function buildMarketsQuery(ids: string[]) {
  const list = ids.map((id) => encodeURIComponent(id)).join(",");
  const params = new URLSearchParams();
  params.set("vs_currency", "usd");
  params.set("ids", list);
  params.set("price_change_percentage", "1h,24h,7d");
  params.set("sparkline", "true");
  return `/coins/markets?${params.toString()}`;
}

function normalizeCoinPrice(raw: CoinsMarketsResponse[number]): CoinPrice {
  return {
    id: String(raw.id ?? ""),
    symbol: String(raw.symbol ?? ""),
    current_price: Number(raw.current_price ?? 0),
    price_change_percentage_1h_in_currency: Number(
      raw.price_change_percentage_1h_in_currency ?? 0,
    ),
    price_change_percentage_24h: Number(
      raw.price_change_percentage_24h ??
        raw.price_change_percentage_24h_in_currency ??
        0,
    ),
    price_change_percentage_7d_in_currency: Number(
      raw.price_change_percentage_7d_in_currency ?? 0,
    ),
    market_cap: Number(raw.market_cap ?? 0),
    total_volume: Number(raw.total_volume ?? 0),
    sparkline_in_7d: { price: raw.sparkline_in_7d?.price ?? [] },
  };
}

export async function getPrices(coinIds: string[]): Promise<CoinPrice[]> {
  const ids = coinIds.map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return [];

  const data = (await coingeckoFetch(buildMarketsQuery(ids))) as CoinsMarketsResponse;
  return (data ?? []).map(normalizeCoinPrice).filter((c) => c.id);
}

export async function getPrice(coinId: string): Promise<CoinPrice> {
  const [coin] = await getPrices([coinId]);
  if (!coin) {
    throw new Error("No se encontró el activo");
  }
  return coin;
}

export async function searchCoins(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const data = (await coingeckoFetch(
    `/search?query=${encodeURIComponent(q)}`,
  )) as SearchResponse;
  return (data.coins ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    thumb: c.thumb,
  }));
}

export async function getSparkline(coinId: string): Promise<number[]> {
  const coin = await getPrice(coinId);
  const points = coin.sparkline_in_7d?.price ?? [];
  if (points.length <= 24) return points;
  return points.slice(points.length - 24);
}
