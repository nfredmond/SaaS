import { NextResponse } from "next/server";
import { deleteRunById, readRuns } from "@/lib/runStore";

export async function GET() {
  return NextResponse.json({ runs: readRuns() });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing run id" }, { status: 400 });
  }

  const runs = deleteRunById(id);
  return NextResponse.json({ runs });
}
