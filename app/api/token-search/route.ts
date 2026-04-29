import { searchCoins } from "@/lib/api/coingecko";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) {
    return Response.json([], { status: 200 });
  }

  const result = await searchCoins(q);
  return Response.json(result, { status: 200 });
}
