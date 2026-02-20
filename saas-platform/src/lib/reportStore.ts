import fs from "node:fs";
import path from "node:path";
import type { ReportRecord } from "@/lib/reportSchema";

const REPORTS_PATH = path.join(process.cwd(), "data", "derived", "reports.json");
const MAX_REPORTS = 50;

function ensureReportsFile() {
  const dir = path.dirname(REPORTS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(REPORTS_PATH)) {
    fs.writeFileSync(REPORTS_PATH, JSON.stringify([], null, 2));
  }
}

export function readReports(): ReportRecord[] {
  ensureReportsFile();
  try {
    const raw = fs.readFileSync(REPORTS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ReportRecord[];
  } catch {
    return [];
  }
}

export function appendReport(report: ReportRecord): ReportRecord[] {
  const current = readReports();
  const updated = [report, ...current].slice(0, MAX_REPORTS);
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

export function getReportById(id: string): ReportRecord | null {
  const current = readReports();
  return current.find((report) => report.id === id) ?? null;
}

export function deleteReportById(id: string): ReportRecord[] {
  const current = readReports();
  const updated = current.filter((report) => report.id !== id);
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

export function clearReports(): ReportRecord[] {
  fs.writeFileSync(REPORTS_PATH, JSON.stringify([], null, 2));
  return [];
}

export function replaceReports(reports: ReportRecord[]): ReportRecord[] {
  const next = reports.slice(0, MAX_REPORTS);
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(next, null, 2));
  return next;
}
