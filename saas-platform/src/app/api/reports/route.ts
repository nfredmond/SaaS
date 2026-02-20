import { NextResponse } from "next/server";
import { readReports } from "@/lib/reportStore";

export async function GET() {
  return NextResponse.json({ reports: readReports() });
}
