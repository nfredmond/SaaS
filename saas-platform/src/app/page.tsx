"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "@/components/MapView";
import type { AnalysisRun, Layer, Metric, ReportPayload, ReportRecord } from "@/lib/reportSchema";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

type ApiResponse = {
  metrics: Metric[];
  layers: Layer[];
  notes?: string[];
  localSummary?: ReportPayload["localSummary"];
  runId?: string;
};

type GeoJsonFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

type RunEntry = AnalysisRun;

type ConfirmAction =
  | { kind: "delete-run"; runId: string }
  | { kind: "clear-runs" }
  | { kind: "delete-report"; report: ReportRecord }
  | { kind: "clear-reports" };

type ToastItem = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};

type RunsResponse = {
  runs?: RunEntry[];
  total?: number;
  filtered?: number;
  latestRun?: RunEntry | null;
};

type ReportsResponse = {
  reports?: ReportRecord[];
  total?: number;
  filtered?: number;
};

const RUN_HISTORY_PAGE_SIZE = 6;
const REPORT_HISTORY_PAGE_SIZE = 4;

const PRESETS = [
  {
    title: "Safety Hotspots",
    query: "Show safety risks near the school corridor",
    details: "Crash clusters + high injury corridors",
  },
  {
    title: "Jobs Access",
    query: "Where do we lose job access after the bypass?",
    details: "30-minute access footprint",
  },
  {
    title: "Equity Screen",
    query: "Highlight equity gaps for low-income households",
    details: "ACS overlays with population weight",
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "running" | "complete">("idle");
  const [metrics, setMetrics] = useState<Metric[]>([
    { name: "jobs_30min", value: 18240, unit: "jobs" },
    { name: "hin_corridors", value: 3, unit: "count" },
    { name: "equity_gap", value: 0.14, unit: "ratio" },
  ]);
  const [layers, setLayers] = useState<Layer[]>([
    { name: "FARS 2022-2024", type: "points" },
    { name: "LODES Jobs", type: "hex" },
    { name: "ACS Demographics", type: "polygons" },
  ]);
  const [notes, setNotes] = useState<string[]>(["No boundary uploaded. Using demo extent."]);
  const [localSummary, setLocalSummary] = useState<ApiResponse["localSummary"]>(null);
  const [boundary, setBoundary] = useState<GeoJsonFeature | null>(null);
  const [boundaryFile, setBoundaryFile] = useState<File | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<RunEntry[]>([]);
  const [runHistorySearch, setRunHistorySearch] = useState("");
  const [runHistoryLimit, setRunHistoryLimit] = useState(RUN_HISTORY_PAGE_SIZE);
  const [runHistoryTotals, setRunHistoryTotals] = useState({ total: 0, filtered: 0 });
  const [reportHistory, setReportHistory] = useState<ReportRecord[]>([]);
  const [reportHistorySearch, setReportHistorySearch] = useState("");
  const [reportHistoryTemplate, setReportHistoryTemplate] = useState<"all" | "corridor" | "ss4a">(
    "all"
  );
  const [reportHistoryLimit, setReportHistoryLimit] = useState(REPORT_HISTORY_PAGE_SIZE);
  const [reportHistoryTotals, setReportHistoryTotals] = useState({ total: 0, filtered: 0 });
  const [mapLayers, setMapLayers] = useState({
    crashPoints: true,
    jobHexes: true,
    corridor: true,
  });
  const [isRunsLoading, setIsRunsLoading] = useState(true);
  const [isReportsLoading, setIsReportsLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const [reportStatus, setReportStatus] = useState<"idle" | "ready">("idle");
  const [reportTemplate, setReportTemplate] = useState<"corridor" | "ss4a">("corridor");
  const [reportDownloadStatus, setReportDownloadStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [reportRedownloadId, setReportRedownloadId] = useState<string | null>(null);
  const [reportRedownloadError, setReportRedownloadError] = useState<string | null>(null);
  const [reportDeleteId, setReportDeleteId] = useState<string | null>(null);
  const [reportDeleteError, setReportDeleteError] = useState<string | null>(null);
  const [runClearStatus, setRunClearStatus] = useState<"idle" | "clearing">("idle");
  const [reportClearStatus, setReportClearStatus] = useState<"idle" | "clearing">("idle");
  const [backupStatus, setBackupStatus] = useState<"idle" | "exporting" | "error">("idle");
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "restoring" | "error">("idle");
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastBackupCounts, setLastBackupCounts] = useState<{ runs: number; reports: number } | null>(
    null
  );
  const [lastRestoreAt, setLastRestoreAt] = useState<string | null>(null);
  const [lastRestoreCounts, setLastRestoreCounts] = useState<{ runs: number; reports: number } | null>(
    null
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const jobsMetric = metrics.find((metric) => metric.name === "jobs_30min");
  const hinMetric = metrics.find((metric) => metric.name === "hin_corridors");
  const equityMetric = metrics.find((metric) => metric.name === "equity_gap");

  const insightLines = useMemo(() => {
    const lines: string[] = [];

    if (jobsMetric) {
      lines.push(
        `${jobsMetric.value.toLocaleString()} jobs reachable within 30 minutes from the corridor.`
      );
    }

    if (hinMetric) {
      lines.push(`${hinMetric.value} high-injury corridor segments flagged in the study area.`);
    }

    if (equityMetric) {
      lines.push(`Equity gap index sits at ${Math.round(equityMetric.value * 100)}%.`);
    }

    return lines;
  }, [jobsMetric, hinMetric, equityMetric]);

  const selectedRun = useMemo(
    () => runHistory.find((run) => run.id === selectedRunId) ?? null,
    [runHistory, selectedRunId]
  );
  const selectedReport = useMemo(
    () => reportHistory.find((report) => report.id === selectedReportId) ?? null,
    [reportHistory, selectedReportId]
  );
  const confirmCopy = useMemo(() => {
    if (!confirmAction) return null;

    switch (confirmAction.kind) {
      case "delete-run":
        return {
          title: "Delete Run",
          description: "This removes the selected run from persistent history.",
          actionLabel: "Delete",
        };
      case "clear-runs":
        return {
          title: "Clear Run History",
          description: "This removes all persisted runs. This cannot be undone.",
          actionLabel: "Clear All",
        };
      case "delete-report":
        return {
          title: "Delete Report",
          description: `Delete report "${confirmAction.report.fileName}" from history.`,
          actionLabel: "Delete",
        };
      case "clear-reports":
        return {
          title: "Clear Report History",
          description: "This removes all persisted reports. This cannot be undone.",
          actionLabel: "Clear All",
        };
      default:
        return null;
    }
  }, [confirmAction]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2800);
  };

  const loadRuns = useCallback(async () => {
    setIsRunsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(runHistoryLimit));
      if (runHistorySearch.trim()) {
        params.set("q", runHistorySearch.trim());
      }

      const response = await fetch(`/api/runs?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as RunsResponse;
      const runs = (payload.runs ?? []) as RunEntry[];
      setRunHistory(runs);
      setRunHistoryTotals({
        total: typeof payload.total === "number" ? payload.total : runs.length,
        filtered: typeof payload.filtered === "number" ? payload.filtered : runs.length,
      });

      const latestRun = payload.latestRun;
      if (latestRun) {
        setLastRunId(latestRun.id);
        setLastRunAt(latestRun.createdAt);
      } else {
        setLastRunId(null);
        setLastRunAt(null);
      }

      setSelectedRunId((prev) => (prev && runs.some((run) => run.id === prev) ? prev : (runs[0]?.id ?? null)));
    } finally {
      setIsRunsLoading(false);
    }
  }, [runHistoryLimit, runHistorySearch]);

  const loadReports = useCallback(async () => {
    setIsReportsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(reportHistoryLimit));
      params.set("template", reportHistoryTemplate);
      if (reportHistorySearch.trim()) {
        params.set("q", reportHistorySearch.trim());
      }

      const response = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ReportsResponse;
      const reports = (payload.reports ?? []) as ReportRecord[];
      setReportHistory(reports);
      setReportHistoryTotals({
        total: typeof payload.total === "number" ? payload.total : reports.length,
        filtered: typeof payload.filtered === "number" ? payload.filtered : reports.length,
      });
      setSelectedReportId((prev) =>
        prev && reports.some((report) => report.id === prev) ? prev : (reports[0]?.id ?? null)
      );
    } finally {
      setIsReportsLoading(false);
    }
  }, [reportHistoryLimit, reportHistorySearch, reportHistoryTemplate]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleBoundaryUpload = async (file: File | null) => {
    setBoundaryFile(file);
    if (!file) {
      setBoundary(null);
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setBoundary(json as GeoJsonFeature);
      setNotes((prev) => [
        `Loaded boundary file: ${file.name}`,
        ...prev.filter((note) => !note.startsWith("Loaded boundary file")),
      ]);
    } catch {
      setBoundary(null);
      setNotes(["Invalid GeoJSON file. Please upload a Feature with Polygon geometry."]);
    }
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setAnalysisStatus("running");
    try {
      const body: Record<string, unknown> = { query };

      if (boundary) {
        body.boundary = boundary;
      }

      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: ApiResponse = await response.json();
      const runId = data.runId ?? crypto.randomUUID();
      const runTime = new Date().toISOString();
      const runNotes = data.notes ?? [];
      const runLayers = data.layers ?? [];
      const runLocalSummary = data.localSummary ?? null;

      setMetrics(data.metrics ?? []);
      setLayers(runLayers);
      setNotes(runNotes);
      setLocalSummary(runLocalSummary);
      setLastRunId(runId);
      setLastRunAt(runTime);
      setSelectedRunId(runId);
      await loadRuns();
      setReportStatus("ready");
      setAnalysisStatus("complete");
      pushToast("success", "Analysis run completed.");
    } catch {
      setAnalysisStatus("idle");
      pushToast("error", "Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const buildReportPayload = (): ReportPayload => ({
    generatedAt: new Date().toISOString(),
    query: query || "Untitled run",
    metrics,
    notes,
    layers,
    localSummary,
    template: reportTemplate,
  });

  const handleShare = async () => {
    try {
      if (typeof window === "undefined") return;
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch {
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  };

  const handleDownloadReport = async () => {
    if (typeof window === "undefined") return;
    const payload = buildReportPayload();
    window.localStorage.setItem("rural-atlas-report", JSON.stringify(payload));
    setReportDownloadStatus("loading");

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("PDF generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rural-atlas-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setReportDownloadStatus("idle");

      await loadReports();
      pushToast("success", "Report PDF downloaded.");
    } catch {
      setReportDownloadStatus("error");
      pushToast("error", "PDF generation failed.");
      setTimeout(() => setReportDownloadStatus("idle"), 2500);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    const response = await fetch(`/api/runs?id=${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      pushToast("error", "Unable to delete run.");
      return;
    }

    await loadRuns();
    pushToast("success", "Run deleted.");
  };

  const handleClearRunHistory = async () => {
    setRunClearStatus("clearing");
    try {
      const response = await fetch("/api/runs?all=true", { method: "DELETE" });
      if (!response.ok) {
        pushToast("error", "Unable to clear run history.");
        return;
      }
      await loadRuns();
      pushToast("info", "Run history cleared.");
    } finally {
      setRunClearStatus("idle");
    }
  };

  const handleRedownloadReport = async (report: ReportRecord) => {
    setReportRedownloadError(null);
    setReportRedownloadId(report.id);

    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}/download`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to re-download report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      pushToast("success", "Report downloaded from history.");
    } catch (error) {
      setReportRedownloadError(error instanceof Error ? error.message : "Unable to re-download report.");
      pushToast("error", "Unable to re-download report.");
      setTimeout(() => setReportRedownloadError(null), 2800);
    } finally {
      setReportRedownloadId(null);
    }
  };

  const handleDeleteReport = async (report: ReportRecord) => {
    setReportDeleteError(null);
    setReportDeleteId(report.id);

    try {
      const response = await fetch(`/api/reports?id=${encodeURIComponent(report.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to delete report.");
      }

      await loadReports();
      pushToast("success", "Report deleted.");
    } catch (error) {
      setReportDeleteError(error instanceof Error ? error.message : "Unable to delete report.");
      pushToast("error", "Unable to delete report.");
      setTimeout(() => setReportDeleteError(null), 2800);
    } finally {
      setReportDeleteId(null);
    }
  };

  const handleClearReportHistory = async () => {
    setReportDeleteError(null);
    setReportClearStatus("clearing");

    try {
      const response = await fetch("/api/reports?all=true", { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to clear reports.");
      }

      await loadReports();
      pushToast("info", "Report history cleared.");
    } catch (error) {
      setReportDeleteError(error instanceof Error ? error.message : "Unable to clear reports.");
      pushToast("error", "Unable to clear report history.");
      setTimeout(() => setReportDeleteError(null), 2800);
    } finally {
      setReportClearStatus("idle");
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);

    try {
      switch (confirmAction.kind) {
        case "delete-run":
          await handleDeleteRun(confirmAction.runId);
          break;
        case "clear-runs":
          await handleClearRunHistory();
          break;
        case "delete-report":
          await handleDeleteReport(confirmAction.report);
          break;
        case "clear-reports":
          await handleClearReportHistory();
          break;
      }
    } finally {
      setConfirmBusy(false);
      setConfirmAction(null);
    }
  };

  const handleExportBackup = async () => {
    setBackupStatus("exporting");
    try {
      const response = await fetch("/api/backup", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to export backup.");
      }

      const payload = await response.json();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rural-atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setLastBackupAt(payload.generatedAt ?? new Date().toISOString());
      setLastBackupCounts({
        runs: Array.isArray(payload.runs) ? payload.runs.length : 0,
        reports: Array.isArray(payload.reports) ? payload.reports.length : 0,
      });
      setBackupStatus("idle");
      pushToast("success", "Backup exported.");
    } catch {
      setBackupStatus("error");
      pushToast("error", "Unable to export backup.");
      setTimeout(() => setBackupStatus("idle"), 2500);
    }
  };

  const handleRestoreButtonClick = () => {
    backupInputRef.current?.click();
  };

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setRestoreError(null);
    setRestoreStatus("restoring");

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { runs?: RunEntry[]; reports?: ReportRecord[] };

      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs: parsed.runs ?? [],
          reports: parsed.reports ?? [],
          mode: restoreMode,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to restore backup.");
      }

      const payload = await response.json();
      await Promise.all([loadRuns(), loadReports()]);
      setLastRestoreAt(payload.restoredAt ?? new Date().toISOString());
      setLastRestoreCounts({
        runs:
          typeof payload.runCount === "number"
            ? payload.runCount
            : Array.isArray(payload.runs)
              ? payload.runs.length
              : 0,
        reports:
          typeof payload.reportCount === "number"
            ? payload.reportCount
            : Array.isArray(payload.reports)
              ? payload.reports.length
              : 0,
      });
      setRestoreStatus("idle");
      pushToast("success", "Backup restored.");
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "Unable to restore backup.");
      setRestoreStatus("error");
      pushToast("error", "Unable to restore backup.");
      setTimeout(() => setRestoreStatus("idle"), 2500);
    }
  };

  return (
    <div className="min-h-screen text-neutral-50 app-shell">
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[320px] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border px-4 py-3 text-sm shadow-xl ${
                toast.tone === "success"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                  : toast.tone === "error"
                    ? "border-rose-400/40 bg-rose-400/10 text-rose-100"
                    : "border-sky-400/40 bg-sky-400/10 text-sky-100"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleRestoreBackup}
      />
      <header className="border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">Rural Atlas</p>
            <h1 className="font-display text-2xl font-semibold text-white">
              Corridor Intelligence Studio
            </h1>
            <p className="text-sm text-neutral-400">
              Analytics-first planning workspace for rural agencies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-neutral-700/70 bg-neutral-900/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-300">
              Status: {analysisStatus}
            </div>
            <button
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
              onClick={handleExportBackup}
              disabled={backupStatus === "exporting"}
            >
              {backupStatus === "exporting" ? "Exporting..." : "Export Backup"}
            </button>
            <button
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
              onClick={handleRestoreButtonClick}
              disabled={restoreStatus === "restoring"}
            >
              {restoreStatus === "restoring" ? "Restoring..." : "Restore Backup"}
            </button>
            <button
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-500"
              onClick={() => setShowReport(true)}
            >
              {reportStatus === "ready" ? "Export Report" : "Draft Report"}
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 pb-4">
          <div className="text-xs text-neutral-500">
            Restore mode:{" "}
            <button
              className="rounded-full border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-300"
              onClick={() => setRestoreMode((prev) => (prev === "replace" ? "merge" : "replace"))}
              disabled={restoreStatus === "restoring"}
            >
              {restoreMode}
            </button>
          </div>
          {restoreError ? <p className="text-xs text-rose-300">{restoreError}</p> : null}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Mission Control</p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                placeholder="Example: Show safety risks near the school corridor"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="grid gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left text-sm text-neutral-200 transition hover:border-neutral-600"
                    onClick={() => setQuery(preset.query)}
                  >
                    <div className="font-semibold">{preset.title}</div>
                    <div className="text-xs text-neutral-500">{preset.details}</div>
                  </button>
                ))}
              </div>
              <button
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-70"
                onClick={handleRunAnalysis}
                disabled={isLoading}
              >
                {isLoading ? "Running..." : "Run Analysis"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Corridor Boundary</p>
            <div className="mt-3 space-y-2 text-sm text-neutral-300">
              <input
                type="file"
                accept=".json,.geojson"
                onChange={(event) => handleBoundaryUpload(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-neutral-500">Upload a GeoJSON Feature with Polygon/MultiPolygon.</p>
              {boundaryFile ? (
                <p className="text-xs text-emerald-300">Loaded: {boundaryFile.name}</p>
              ) : (
                <p className="text-xs text-neutral-500">No file selected.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Key Metrics</p>
            <div className="mt-4 space-y-3">
              {metrics.map((metric) => (
                <div
                  key={metric.name}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"
                >
                  <p className="text-xs text-neutral-500">{metric.name}</p>
                  <p className="text-2xl font-semibold">
                    {metric.unit === "ratio"
                      ? `${Math.round(metric.value * 100)}%`
                      : metric.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Layer Switchboard</p>
            <div className="mt-4 space-y-2 text-sm text-neutral-300">
              {[
                { key: "crashPoints", label: "Crash Points (FARS)" },
                { key: "jobHexes", label: "Jobs Access Hexes" },
                { key: "corridor", label: "Corridor Boundary" },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-3">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-white"
                    checked={mapLayers[item.key as keyof typeof mapLayers]}
                    onChange={(event) =>
                      setMapLayers((prev) => ({ ...prev, [item.key]: event.target.checked }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Active Layers</p>
            <div className="mt-4 space-y-2 text-sm text-neutral-300">
              {layers.map((layer) => (
                <div key={layer.name} className="flex items-center justify-between">
                  <span>{layer.name}</span>
                  <span className="text-xs text-neutral-500">{layer.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Run Notes</p>
            <div className="mt-3 space-y-2 text-xs text-neutral-400">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Run History</p>
              <button
                className="rounded-full border border-neutral-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500 disabled:opacity-70"
                onClick={() => setConfirmAction({ kind: "clear-runs" })}
                disabled={runClearStatus === "clearing" || runHistoryTotals.total === 0}
              >
                {runClearStatus === "clearing" ? "Clearing..." : "Clear"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500"
                placeholder="Search run query or notes..."
                value={runHistorySearch}
                onChange={(event) => {
                  setRunHistorySearch(event.target.value);
                  setRunHistoryLimit(RUN_HISTORY_PAGE_SIZE);
                }}
              />
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Showing {runHistory.length} of {runHistoryTotals.filtered} filtered ({runHistoryTotals.total} total)
              </p>
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              {isRunsLoading ? (
                <p className="text-xs text-neutral-500">Loading runs...</p>
              ) : runHistory.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  {runHistoryTotals.total > 0 ? "No runs match this filter." : "No runs yet."}
                </p>
              ) : (
                runHistory.map((run) => (
                  <button
                    key={run.id}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedRunId === run.id
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : "border-neutral-800 bg-neutral-950 hover:border-neutral-600"
                    }`}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    <p className="text-xs text-neutral-500">
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                    <p className="font-semibold text-neutral-100">{run.query}</p>
                    {run.notes?.[0] ? <p className="text-xs text-neutral-500">{run.notes[0]}</p> : null}
                  </button>
                ))
              )}
              {runHistory.length < runHistoryTotals.filtered ? (
                <button
                  className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-xs uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500 disabled:opacity-70"
                  onClick={() =>
                    setRunHistoryLimit((prev) => Math.min(prev + RUN_HISTORY_PAGE_SIZE, runHistoryTotals.filtered))
                  }
                  disabled={isRunsLoading}
                >
                  Load More
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Recent Reports</p>
              <button
                className="rounded-full border border-neutral-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500 disabled:opacity-70"
                onClick={() => setConfirmAction({ kind: "clear-reports" })}
                disabled={reportClearStatus === "clearing" || reportHistoryTotals.total === 0}
              >
                {reportClearStatus === "clearing" ? "Clearing..." : "Clear"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500"
                placeholder="Search report name or query..."
                value={reportHistorySearch}
                onChange={(event) => {
                  setReportHistorySearch(event.target.value);
                  setReportHistoryLimit(REPORT_HISTORY_PAGE_SIZE);
                }}
              />
              <select
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
                value={reportHistoryTemplate}
                onChange={(event) => {
                  setReportHistoryTemplate(event.target.value as "all" | "corridor" | "ss4a");
                  setReportHistoryLimit(REPORT_HISTORY_PAGE_SIZE);
                }}
              >
                <option value="all">All templates</option>
                <option value="corridor">Corridor template</option>
                <option value="ss4a">SS4A template</option>
              </select>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Showing {reportHistory.length} of {reportHistoryTotals.filtered} filtered (
                {reportHistoryTotals.total} total)
              </p>
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              {reportRedownloadError ? (
                <p className="text-xs text-rose-300">{reportRedownloadError}</p>
              ) : null}
              {reportDeleteError ? (
                <p className="text-xs text-rose-300">{reportDeleteError}</p>
              ) : null}
              {isReportsLoading ? (
                <p className="text-xs text-neutral-500">Loading reports...</p>
              ) : reportHistory.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  {reportHistoryTotals.total > 0
                    ? "No reports match this filter."
                    : "No reports generated yet."}
                </p>
              ) : (
                reportHistory.map((report) => (
                  <div
                    key={report.id}
                    className={`rounded-xl border bg-neutral-950 p-3 ${
                      selectedReportId === report.id
                        ? "border-emerald-400/60"
                        : "border-neutral-800"
                    }`}
                    onClick={() => setSelectedReportId(report.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-neutral-500">
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                      <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                        {report.template}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-semibold text-neutral-100">{report.fileName}</p>
                    <p className="text-xs text-neutral-500">{report.query}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReportId(report.id);
                        }}
                      >
                        View
                      </button>
                      <button
                        className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRedownloadReport(report);
                        }}
                        disabled={
                          reportRedownloadId === report.id ||
                          reportDeleteId === report.id ||
                          reportClearStatus === "clearing"
                        }
                      >
                        {reportRedownloadId === report.id ? "Rebuilding..." : "Re-download"}
                      </button>
                      <button
                        className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-300 disabled:opacity-70"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmAction({ kind: "delete-report", report });
                        }}
                        disabled={
                          reportDeleteId === report.id ||
                          reportRedownloadId === report.id ||
                          reportClearStatus === "clearing"
                        }
                      >
                        {reportDeleteId === report.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
              {reportHistory.length < reportHistoryTotals.filtered ? (
                <button
                  className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-xs uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500 disabled:opacity-70"
                  onClick={() =>
                    setReportHistoryLimit((prev) =>
                      Math.min(prev + REPORT_HISTORY_PAGE_SIZE, reportHistoryTotals.filtered)
                    )
                  }
                  disabled={isReportsLoading}
                >
                  Load More
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Data Operations</p>
            <div className="mt-3 space-y-3 text-xs text-neutral-400">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <p className="text-neutral-500">Last Backup</p>
                <p>{lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "Not yet exported"}</p>
                <p>
                  Runs: {lastBackupCounts?.runs ?? 0} | Reports: {lastBackupCounts?.reports ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <p className="text-neutral-500">Last Restore</p>
                <p>{lastRestoreAt ? new Date(lastRestoreAt).toLocaleString() : "No restore yet"}</p>
                <p>
                  Runs: {lastRestoreCounts?.runs ?? 0} | Reports: {lastRestoreCounts?.reports ?? 0}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-neutral-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
                  onClick={handleExportBackup}
                  disabled={backupStatus === "exporting"}
                >
                  {backupStatus === "exporting" ? "Exporting..." : "Export"}
                </button>
                <button
                  className="rounded-full border border-neutral-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
                  onClick={handleRestoreButtonClick}
                  disabled={restoreStatus === "restoring"}
                >
                  {restoreStatus === "restoring" ? "Restoring..." : "Restore"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Selected Report</p>
            {selectedReport ? (
              <div className="mt-3 space-y-3 text-sm text-neutral-300">
                <div>
                  <p className="font-semibold text-neutral-100">{selectedReport.fileName}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
                    Template: {selectedReport.template}
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
                    Payload: {selectedReport.hasPayload ? "available" : "missing"}
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
                    Metrics: {selectedReport.metricCount}
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
                    Notes: {selectedReport.noteCount}
                  </div>
                </div>
                <p className="text-xs text-neutral-500">{selectedReport.query}</p>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
                    onClick={() => handleRedownloadReport(selectedReport)}
                    disabled={
                      reportRedownloadId === selectedReport.id ||
                      reportDeleteId === selectedReport.id ||
                      reportClearStatus === "clearing"
                    }
                  >
                    {reportRedownloadId === selectedReport.id ? "Rebuilding..." : "Re-download"}
                  </button>
                  <button
                    className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-300 disabled:opacity-70"
                    onClick={() => setConfirmAction({ kind: "delete-report", report: selectedReport })}
                    disabled={
                      reportDeleteId === selectedReport.id ||
                      reportRedownloadId === selectedReport.id ||
                      reportClearStatus === "clearing"
                    }
                  >
                    {reportDeleteId === selectedReport.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-neutral-500">Select a report to inspect details.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-4 shadow-xl float-in">
            <div className="flex flex-wrap items-center justify-between gap-4 px-2 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Live Map</p>
                <h2 className="font-display text-xl text-white">Corridor View</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  className="rounded-full border border-neutral-700 px-4 py-2 text-neutral-200 transition hover:border-neutral-500"
                  onClick={handleShare}
                >
                  Share Link
                </button>
                <button
                  className="rounded-full bg-emerald-400/90 px-4 py-2 font-semibold text-neutral-900 transition hover:bg-emerald-300"
                  onClick={() => setShowReport(true)}
                >
                  Generate Brief
                </button>
              </div>
            </div>
            <div className="relative h-[560px] overflow-hidden rounded-2xl border border-neutral-800">
              <MapView
                boundary={boundary}
                showBoundary={mapLayers.corridor}
                showCrashPoints={mapLayers.crashPoints}
                showJobHexes={mapLayers.jobHexes}
              />
              {shareStatus !== "idle" ? (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-neutral-800 bg-neutral-950/90 px-4 py-2 text-xs text-neutral-200 shadow-lg">
                  {shareStatus === "copied"
                    ? "Link copied to clipboard."
                    : "Unable to copy link."}
                </div>
              ) : null}
              <div className="absolute bottom-4 left-4 space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-xs text-neutral-200 shadow-lg">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Legend</p>
                {mapLayers.crashPoints ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    <span>Crash points</span>
                  </div>
                ) : null}
                {mapLayers.jobHexes ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm bg-rose-400" />
                    <span>Jobs access hexes</span>
                  </div>
                ) : null}
                {mapLayers.corridor ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm bg-amber-200" />
                    <span>Corridor boundary</span>
                  </div>
                ) : null}
              </div>
              <div className="absolute bottom-4 right-4 space-y-1 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-xs text-neutral-200 shadow-lg">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Last Run</p>
                {lastRunId ? (
                  <>
                    <p>Run ID: {lastRunId.slice(0, 8)}</p>
                    <p>{lastRunAt ? new Date(lastRunAt).toLocaleString() : "Timestamp pending"}</p>
                  </>
                ) : (
                  <p>No analysis yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Insights</p>
              <div className="mt-3 space-y-2 text-sm text-neutral-300">
                {insightLines.length === 0 ? (
                  <p className="text-neutral-500">Run an analysis to generate insights.</p>
                ) : (
                  insightLines.map((line) => <p key={line}>{line}</p>)
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Local Ingest</p>
              <div className="mt-3 space-y-2 text-xs text-neutral-400">
                {localSummary ? (
                  <>
                    <p>Boundary: {localSummary.boundaryType ?? "unknown"}</p>
                    {localSummary.bbox ? (
                      <p>
                        BBox: {localSummary.bbox.minX.toFixed(3)}, {localSummary.bbox.minY.toFixed(3)} →{" "}
                        {localSummary.bbox.maxX.toFixed(3)}, {localSummary.bbox.maxY.toFixed(3)}
                      </p>
                    ) : null}
                    {localSummary.centroid ? (
                      <p>
                        Centroid: {localSummary.centroid.lon.toFixed(3)}, {localSummary.centroid.lat.toFixed(3)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>No local ingest summary yet.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Execution Timeline</p>
            <div className="mt-3 space-y-2 text-sm text-neutral-300">
              <div className="flex items-center justify-between">
                <span>Boundary ingest</span>
                <span className="text-xs text-neutral-500">
                  {boundary ? "Complete" : "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>National dataset clip</span>
                <span className="text-xs text-neutral-500">
                  {analysisStatus === "complete" ? "Complete" : "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Analytics run</span>
                <span className="text-xs text-neutral-500">{analysisStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Report draft</span>
                <span className="text-xs text-neutral-500">
                  {analysisStatus === "complete" ? "Ready" : "Waiting"}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Selected Run</p>
            {selectedRun ? (
              <div className="mt-3 space-y-3 text-sm text-neutral-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">Query</p>
                    <p className="font-semibold text-neutral-100">{selectedRun.query}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(selectedRun.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-300"
                    onClick={() => setConfirmAction({ kind: "delete-run", runId: selectedRun.id })}
                  >
                    Delete
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {selectedRun.metrics.map((metric) => (
                    <div
                      key={metric.name}
                      className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2"
                    >
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                        {metric.name}
                      </p>
                      <p className="text-base font-semibold text-neutral-100">
                        {metric.unit === "ratio"
                          ? `${Math.round(metric.value * 100)}%`
                          : metric.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                {selectedRun.notes?.length ? (
                  <div className="space-y-1 text-xs text-neutral-400">
                    {selectedRun.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-neutral-500">Select a run to inspect details.</p>
            )}
          </div>
        </section>
      </main>

      {confirmAction && confirmCopy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-6">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Confirm Action</p>
            <h3 className="mt-2 text-lg font-semibold text-neutral-100">{confirmCopy.title}</h3>
            <p className="mt-2 text-sm text-neutral-400">{confirmCopy.description}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-neutral-700 px-4 py-2 text-xs text-neutral-200 transition hover:border-neutral-500 disabled:opacity-70"
                onClick={() => setConfirmAction(null)}
                disabled={confirmBusy}
              >
                Cancel
              </button>
              <button
                className="rounded-full border border-rose-400/50 bg-rose-400/10 px-4 py-2 text-xs text-rose-200 transition hover:border-rose-300 disabled:opacity-70"
                onClick={handleConfirmAction}
                disabled={confirmBusy}
              >
                {confirmBusy ? "Working..." : confirmCopy.actionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReport ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/80 p-6">
          <div className="w-full max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Report Preview</p>
                <h2 className="font-display text-2xl text-white">FHWA-Ready Corridor Brief</h2>
                <p className="text-sm text-neutral-400">
                  Drafted from the latest analytics snapshot.
                </p>
              </div>
              <button
                className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300"
                onClick={() => setShowReport(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                  Executive Summary
                </p>
                <p className="mt-2">
                  This corridor experiences elevated safety risk and moderate job access gaps relative to
                  peer rural corridors. The analysis highlights priority segments for investment and
                  equity-focused interventions.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Key Findings</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {insightLines.length ? (
                    insightLines.map((line) => <li key={line}>{line}</li>)
                  ) : (
                    <li>Run an analysis to populate corridor findings.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Equity Notes</p>
                <p className="mt-2">
                  Equity gap indicators suggest targeted improvements near lower-income clusters. Prioritize
                  safe crossings and access to essential services.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Safety Notes</p>
                <p className="mt-2">
                  High injury network segments align with crash clusters near the school corridor.
                  Recommend speed management and visibility upgrades.
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm text-neutral-300">
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Report Template</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  {
                    key: "corridor",
                    title: "Corridor Brief",
                    details: "General planning summary for rural agencies.",
                  },
                  {
                    key: "ss4a",
                    title: "SS4A Grant Brief",
                    details: "Safety-focused framing aligned to SS4A.",
                  },
                ].map((template) => (
                  <label
                    key={template.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                      reportTemplate === template.key
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : "border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-template"
                      className="mt-1 accent-emerald-300"
                      checked={reportTemplate === template.key}
                      onChange={() => setReportTemplate(template.key as "corridor" | "ss4a")}
                    />
                    <span>
                      <div className="font-semibold text-neutral-100">{template.title}</div>
                      <div className="text-xs text-neutral-500">{template.details}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-500">
                Data sources: ACS 5-year, LODES, FARS, local boundary uploads.
              </div>
              <div className="flex items-center gap-3">
                {reportDownloadStatus === "error" ? (
                  <span className="text-xs text-rose-300">PDF generation failed.</span>
                ) : null}
                <button
                  className="rounded-full bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-70"
                  onClick={handleDownloadReport}
                  disabled={reportDownloadStatus === "loading"}
                >
                  {reportDownloadStatus === "loading" ? "Building PDF..." : "Download PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
