import { NextResponse } from "next/server";
import { readRuns } from "@/lib/runStore";

export async function GET() {
  return NextResponse.json({ runs: readRuns() });
}
