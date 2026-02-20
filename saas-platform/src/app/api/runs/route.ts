import { NextResponse } from "next/server";
import { clearRuns, deleteRunById, readRuns } from "@/lib/runStore";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function matchesRunQuery(run: ReturnType<typeof readRuns>[number], query: string): boolean {
  if (!query) return true;
  if (run.query.toLowerCase().includes(query)) return true;
  return run.notes?.some((note) => note.toLowerCase().includes(query)) ?? false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = parseLimit(searchParams.get("limit"));
  const allRuns = readRuns();
  const filteredRuns = allRuns.filter((run) => matchesRunQuery(run, query));

  return NextResponse.json({
    runs: filteredRuns.slice(0, limit),
    total: allRuns.length,
    filtered: filteredRuns.length,
    latestRun: allRuns[0] ?? null,
    query,
    limit,
  });
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
