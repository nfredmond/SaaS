import { NextResponse } from "next/server";
import { deleteReportById, readReports } from "@/lib/reportStore";

function toPublicReport(report: ReturnType<typeof readReports>[number]) {
  return {
    id: report.id,
    createdAt: report.createdAt,
    fileName: report.fileName,
    template: report.template,
    query: report.query,
    metricCount: report.metricCount,
    noteCount: report.noteCount,
  };
}

export async function GET() {
  const reports = readReports().map(toPublicReport);
  return NextResponse.json({ reports });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing report id" }, { status: 400 });
  }

  const reports = deleteReportById(id).map(toPublicReport);
  return NextResponse.json({ reports });
}
