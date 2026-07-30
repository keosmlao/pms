import { type NextRequest, NextResponse } from "next/server";
import { searchCatalogItems } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const cur = request.nextUrl.searchParams.get("cur") === "01" ? "01" : "02";
  const channel = request.nextUrl.searchParams.get("channel") === "wholesale" ? "wholesale" : "retail";
  return NextResponse.json(await searchCatalogItems(q, cur, channel, 20));
}
