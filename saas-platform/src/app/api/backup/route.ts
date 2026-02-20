import { NextResponse } from "next/server";
import { readRuns } from "@/lib/runStore";
import { readReports } from "@/lib/reportStore";

export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    runs: readRuns(),
    reports: readReports(),
  });
}
