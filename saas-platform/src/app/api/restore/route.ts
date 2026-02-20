import { NextResponse } from "next/server";
import { z } from "zod";
import type { AnalysisRun, ReportRecord } from "@/lib/reportSchema";
import { readRuns, replaceRuns } from "@/lib/runStore";
import { readReports, replaceReports } from "@/lib/reportStore";

const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
});

const LayerSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const LocalSummarySchema = z
  .object({
    boundaryType: z.string().optional(),
    bbox: z
      .object({
        minX: z.number(),
        minY: z.number(),
        maxX: z.number(),
        maxY: z.number(),
      })
      .nullable()
      .optional(),
    centroid: z
      .object({
        lon: z.number(),
        lat: z.number(),
      })
      .nullable()
      .optional(),
    generatedAt: z.string().optional(),
  })
  .nullable()
  .optional();

const AnalysisRunSchema = z.object({
  id: z.string().min(1),
  query: z.string(),
  createdAt: z.string(),
  metrics: z.array(MetricSchema),
  layers: z.array(LayerSchema),
  notes: z.array(z.string()).optional(),
  localSummary: LocalSummarySchema,
});

const ReportPayloadSchema = z.object({
  generatedAt: z.string(),
  query: z.string(),
  metrics: z.array(MetricSchema),
  notes: z.array(z.string()),
  layers: z.array(LayerSchema),
  localSummary: LocalSummarySchema,
  template: z.enum(["corridor", "ss4a"]),
});

const ReportRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  fileName: z.string(),
  template: z.enum(["corridor", "ss4a"]),
  query: z.string(),
  metricCount: z.number(),
  noteCount: z.number(),
  payload: ReportPayloadSchema.optional(),
});

const RestoreSchema = z.object({
  runs: z.array(AnalysisRunSchema).optional(),
  reports: z.array(ReportRecordSchema).optional(),
  mode: z.enum(["replace", "merge"]).default("replace"),
});

const HISTORY_LIMIT = 50;

function byCreatedAtDesc<T extends { createdAt: string }>(a: T, b: T): number {
  const aTime = Number(new Date(a.createdAt));
  const bTime = Number(new Date(b.createdAt));
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
  return bTime - aTime;
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    deduped.push(row);
  }

  return deduped;
}

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
  const incomingRuns = parsed.data.runs ?? [];
  const incomingReports = parsed.data.reports ?? [];

  const nextRuns =
    mode === "merge"
      ? dedupeById([...incomingRuns, ...readRuns()].sort(byCreatedAtDesc)).slice(0, HISTORY_LIMIT)
      : dedupeById(incomingRuns.sort(byCreatedAtDesc)).slice(0, HISTORY_LIMIT);
  const nextReports =
    mode === "merge"
      ? dedupeById([...incomingReports, ...readReports()].sort(byCreatedAtDesc)).slice(
          0,
          HISTORY_LIMIT
        )
      : dedupeById(incomingReports.sort(byCreatedAtDesc)).slice(0, HISTORY_LIMIT);

  const runs = replaceRuns(nextRuns as AnalysisRun[]);
  const reports = replaceReports(nextReports as ReportRecord[]);

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
