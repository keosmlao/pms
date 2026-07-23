import { readFile } from "fs/promises";
import path from "path";
import { type NextRequest, NextResponse } from "next/server";
import { getAttachment } from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "po");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const att = await getAttachment(Number(id));
  if (!att) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Guard against path traversal — resolved path must stay inside STORAGE_ROOT.
  const full = path.resolve(STORAGE_ROOT, att.file_path);
  if (!full.startsWith(path.resolve(STORAGE_ROOT))) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    const buf = await readFile(full);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": att.content_type || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(att.file_name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
}
