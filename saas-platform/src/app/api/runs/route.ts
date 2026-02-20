import { NextResponse } from "next/server";
import { clearRuns, deleteRunById, readRuns } from "@/lib/runStore";

export async function GET() {
  return NextResponse.json({ runs: readRuns() });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const clearAll = searchParams.get("all") === "true";
  const id = searchParams.get("id");

  if (clearAll) {
    return NextResponse.json({ runs: clearRuns() });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing run id" }, { status: 400 });
  }

  const runs = deleteRunById(id);
  return NextResponse.json({ runs });
}
