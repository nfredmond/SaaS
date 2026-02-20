import { NextResponse } from "next/server";
import { appendReport } from "@/lib/reportStore";
import { buildReportPdfBytes, ReportSchema } from "@/lib/reportPdf";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const reportId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const fileName = `rural-atlas-report-${createdAt.slice(0, 10)}.pdf`;

  const bytes = await buildReportPdfBytes(payload);

  appendReport({
    id: reportId,
    createdAt,
    fileName,
    template: payload.template,
    query: payload.query,
    metricCount: payload.metrics.length,
    noteCount: payload.notes.length,
    payload,
  });

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

export const runtime = "nodejs";
