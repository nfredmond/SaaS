import fs from "node:fs";
import path from "node:path";
import type { AnalysisRun } from "@/lib/reportSchema";

const RUNS_PATH = path.join(process.cwd(), "data", "derived", "runs.json");
const MAX_RUNS = 50;

function ensureRunsFile() {
  const dir = path.dirname(RUNS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(RUNS_PATH)) {
    fs.writeFileSync(RUNS_PATH, JSON.stringify([], null, 2));
  }
}

export function readRuns(): AnalysisRun[] {
  ensureRunsFile();
  try {
    const raw = fs.readFileSync(RUNS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AnalysisRun[];
  } catch {
    return [];
  }
}

export function appendRun(run: AnalysisRun): AnalysisRun[] {
  const current = readRuns();
  const updated = [run, ...current].slice(0, MAX_RUNS);
  fs.writeFileSync(RUNS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

export function deleteRunById(id: string): AnalysisRun[] {
  const current = readRuns();
  const updated = current.filter((run) => run.id !== id);
  fs.writeFileSync(RUNS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

export function clearRuns(): AnalysisRun[] {
  fs.writeFileSync(RUNS_PATH, JSON.stringify([], null, 2));
  return [];
}
