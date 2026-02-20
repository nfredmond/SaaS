import { NextResponse } from "next/server";
import { clearReports, deleteReportById, readReports } from "@/lib/reportStore";
import type { ReportPayload } from "@/lib/reportSchema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

type TemplateFilter = ReportPayload["template"] | "all";

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseTemplate(value: string | null): TemplateFilter {
  if (value === "corridor" || value === "ss4a") return value;
  return "all";
}

function toPublicReport(report: ReturnType<typeof readReports>[number]) {
  return {
    id: report.id,
    createdAt: report.createdAt,
    fileName: report.fileName,
    template: report.template,
    query: report.query,
    metricCount: report.metricCount,
    noteCount: report.noteCount,
    hasPayload: Boolean(report.payload),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = parseLimit(searchParams.get("limit"));
  const template = parseTemplate(searchParams.get("template"));

  const allReports = readReports();
  const filteredReports = allReports.filter((report) => {
    if (template !== "all" && report.template !== template) return false;
    if (!query) return true;
    return (
      report.query.toLowerCase().includes(query) ||
      report.fileName.toLowerCase().includes(query) ||
      report.template.toLowerCase().includes(query)
    );
  });

  return NextResponse.json({
    reports: filteredReports.slice(0, limit).map(toPublicReport),
    total: allReports.length,
    filtered: filteredReports.length,
    query,
    template,
    limit,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const clearAll = searchParams.get("all") === "true";
  const id = searchParams.get("id");

  if (clearAll) {
    return NextResponse.json({ reports: clearReports().map(toPublicReport) });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing report id" }, { status: 400 });
  }

  const reports = deleteReportById(id).map(toPublicReport);
  return NextResponse.json({ reports });
}
