import { z } from "zod";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { appendRun } from "@/lib/runStore";

const AnalysisRequest = z.object({
  query: z.string().optional(),
  boundary: z
    .object({
      type: z.literal("Feature"),
      geometry: z.object({
        type: z.enum(["Polygon", "MultiPolygon"]),
        coordinates: z.any(),
      }),
      properties: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = AnalysisRequest.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const query = parsed.data.query?.toLowerCase() ?? "";
  const isSafety = query.includes("safety") || query.includes("crash");
  const isAccess = query.includes("access") || query.includes("jobs");

  const summaryPath = path.join(process.cwd(), "data", "derived", "summary.json");
  const localSummary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, "utf-8"))
    : null;

  const runId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const metrics = [
    { name: "jobs_30min", value: isAccess ? 22480 : 18240, unit: "jobs" },
    { name: "hin_corridors", value: isSafety ? 5 : 3, unit: "count" },
    { name: "equity_gap", value: 0.14, unit: "ratio" },
  ];
  const layers = [
    { name: "FARS 2022-2024", type: "points" },
    { name: "LODES Jobs", type: "hex" },
    { name: "ACS Demographics", type: "polygons" },
  ];
  const notes = [
    parsed.data.boundary
      ? "Boundary received. Clipping datasets to corridor."
      : "No boundary uploaded. Using demo extent.",
    query ? `Query interpreted as: ${query}` : "No query provided.",
    localSummary
      ? `Local ingest: ${localSummary.boundaryType}, bbox=${localSummary.bbox?.minX?.toFixed?.(3)},${localSummary.bbox?.minY?.toFixed?.(3)}`
      : "Local ingest summary not found.",
  ];

  appendRun({
    id: runId,
    query: parsed.data.query?.trim() || "Untitled run",
    createdAt,
    metrics,
    layers,
    notes,
    localSummary,
  });

  return NextResponse.json({
    runId,
    createdAt,
    metrics,
    layers,
    localSummary,
    notes,
  });
}
