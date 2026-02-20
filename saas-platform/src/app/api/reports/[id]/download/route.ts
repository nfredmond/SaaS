import { NextResponse } from "next/server";
import { buildReportPdfBytes } from "@/lib/reportPdf";
import { getReportById } from "@/lib/reportStore";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const report = getReportById(id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (!report.payload) {
    return NextResponse.json(
      { error: "This report predates payload persistence and cannot be regenerated." },
      { status: 409 }
    );
  }

  const bytes = await buildReportPdfBytes(report.payload);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
    },
  });
}

export const runtime = "nodejs";
