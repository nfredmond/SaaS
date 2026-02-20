import { NextResponse } from "next/server";
import { z } from "zod";
import type { AnalysisRun, ReportRecord } from "@/lib/reportSchema";
import { readRuns, replaceRuns } from "@/lib/runStore";
import { readReports, replaceReports } from "@/lib/reportStore";

const RestoreSchema = z.object({
  runs: z.array(z.unknown()).optional(),
  reports: z.array(z.unknown()).optional(),
  mode: z.enum(["replace", "merge"]).default("replace"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RestoreSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid restore payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const mode = parsed.data.mode;
  const incomingRuns = (parsed.data.runs ?? []) as AnalysisRun[];
  const incomingReports = (parsed.data.reports ?? []) as ReportRecord[];

  const nextRuns =
    mode === "merge" ? [...incomingRuns, ...readRuns()].slice(0, 50) : incomingRuns.slice(0, 50);
  const nextReports =
    mode === "merge"
      ? [...incomingReports, ...readReports()].slice(0, 50)
      : incomingReports.slice(0, 50);

  const runs = replaceRuns(nextRuns);
  const reports = replaceReports(nextReports);

  return NextResponse.json({
    restoredAt: new Date().toISOString(),
    mode,
    runCount: runs.length,
    reportCount: reports.length,
    runs,
    reports: reports.map((report) => ({
      id: report.id,
      createdAt: report.createdAt,
      fileName: report.fileName,
      template: report.template,
      query: report.query,
      metricCount: report.metricCount,
      noteCount: report.noteCount,
      hasPayload: Boolean(report.payload),
    })),
  });
}

export const runtime = "nodejs";
