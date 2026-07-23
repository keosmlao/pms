import { type NextRequest, NextResponse } from "next/server";
import { searchApprovedPr } from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await searchApprovedPr(q, 20));
}
