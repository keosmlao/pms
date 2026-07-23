import { type NextRequest, NextResponse } from "next/server";
import { getPrImportLines } from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(null, { status: 401 });
  const pr = request.nextUrl.searchParams.get("pr") ?? "";
  if (!pr) return NextResponse.json(null);
  return NextResponse.json(await getPrImportLines(pr));
}
