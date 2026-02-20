import { NextResponse } from "next/server";
import { readReports } from "@/lib/reportStore";

export async function GET() {
  const reports = readReports().map((report) => ({
    id: report.id,
    createdAt: report.createdAt,
    fileName: report.fileName,
    template: report.template,
    query: report.query,
    metricCount: report.metricCount,
    noteCount: report.noteCount,
  }));
  return NextResponse.json({ reports });
}
