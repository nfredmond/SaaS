"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [reportHistory, setReportHistory] = useState<ReportRecord[]>([]);
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

  useEffect(() => {
    let active = true;

    async function loadRuns() {
      setIsRunsLoading(true);
      try {
        const response = await fetch("/api/runs", { cache: "no-store" });
        const payload = await response.json();
        const runs = (payload?.runs ?? []) as RunEntry[];
        if (!active) return;
        setRunHistory(runs);
        if (runs[0]) {
          setLastRunId(runs[0].id);
          setLastRunAt(runs[0].createdAt);
          setSelectedRunId((prev) => prev ?? runs[0].id);
        }
      } finally {
        if (active) setIsRunsLoading(false);
      }
    }

    loadRuns();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setIsReportsLoading(true);
      try {
        const response = await fetch("/api/reports", { cache: "no-store" });
        const payload = await response.json();
        const reports = (payload?.reports ?? []) as ReportRecord[];
        if (!active) return;
        setReportHistory(reports);
        setSelectedReportId((prev) =>
          prev && reports.some((report) => report.id === prev) ? prev : (reports[0]?.id ?? null)
        );
      } finally {
        if (active) setIsReportsLoading(false);
      }
    }

    loadReports();
    return () => {
      active = false;
    };
  }, []);

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
      const runQuery = query.trim() || "Untitled run";

      setMetrics(data.metrics ?? []);
      setLayers(runLayers);
      setNotes(runNotes);
      setLocalSummary(runLocalSummary);
      setLastRunId(runId);
      setLastRunAt(runTime);
      setRunHistory((prev) => [
        {
          id: runId,
          query: runQuery,
          createdAt: runTime,
          metrics: data.metrics ?? [],
          layers: runLayers,
          notes: runNotes,
          localSummary: runLocalSummary,
        },
        ...prev,
      ]);
      setSelectedRunId(runId);
      setReportStatus("ready");
      setAnalysisStatus("complete");
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

      const reportsResponse = await fetch("/api/reports", { cache: "no-store" });
      const reportsPayload = await reportsResponse.json();
      const reports = (reportsPayload?.reports ?? []) as ReportRecord[];
      setReportHistory(reports);
      setSelectedReportId((prev) =>
        prev && reports.some((report) => report.id === prev) ? prev : (reports[0]?.id ?? null)
      );
    } catch {
      setReportDownloadStatus("error");
      setTimeout(() => setReportDownloadStatus("idle"), 2500);
    }
  };

  const handleDeleteSelectedRun = async () => {
    if (!selectedRunId) return;

    const response = await fetch(`/api/runs?id=${encodeURIComponent(selectedRunId)}`, {
      method: "DELETE",
    });

    if (!response.ok) return;

    const payload = await response.json();
    const runs = (payload?.runs ?? []) as RunEntry[];
    setRunHistory(runs);

    if (runs[0]) {
      setSelectedRunId(runs[0].id);
      setLastRunId(runs[0].id);
      setLastRunAt(runs[0].createdAt);
      return;
    }

    setSelectedRunId(null);
    setLastRunId(null);
    setLastRunAt(null);
  };

  const handleClearRunHistory = async () => {
    setRunClearStatus("clearing");
    try {
      const response = await fetch("/api/runs?all=true", { method: "DELETE" });
      if (!response.ok) return;
      const payload = await response.json();
      const runs = (payload?.runs ?? []) as RunEntry[];
      setRunHistory(runs);
      setSelectedRunId(null);
      setLastRunId(null);
      setLastRunAt(null);
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
    } catch (error) {
      setReportRedownloadError(error instanceof Error ? error.message : "Unable to re-download report.");
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

      const payload = await response.json();
      const reports = (payload?.reports ?? []) as ReportRecord[];
      setReportHistory(reports);
      if (reports[0]) {
        setSelectedReportId((prev) => (prev === report.id ? reports[0].id : prev));
      } else {
        setSelectedReportId(null);
      }
    } catch (error) {
      setReportDeleteError(error instanceof Error ? error.message : "Unable to delete report.");
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

      const payload = await response.json();
      const reports = (payload?.reports ?? []) as ReportRecord[];
      setReportHistory(reports);
      setSelectedReportId(null);
    } catch (error) {
      setReportDeleteError(error instanceof Error ? error.message : "Unable to clear reports.");
      setTimeout(() => setReportDeleteError(null), 2800);
    } finally {
      setReportClearStatus("idle");
    }
  };

  return (
    <div className="min-h-screen text-neutral-50 app-shell">
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
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-500"
              onClick={() => setShowReport(true)}
            >
              {reportStatus === "ready" ? "Export Report" : "Draft Report"}
            </button>
          </div>
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
                onClick={handleClearRunHistory}
                disabled={runClearStatus === "clearing" || runHistory.length === 0}
              >
                {runClearStatus === "clearing" ? "Clearing..." : "Clear"}
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              {isRunsLoading ? (
                <p className="text-xs text-neutral-500">Loading runs...</p>
              ) : runHistory.length === 0 ? (
                <p className="text-xs text-neutral-500">No runs yet.</p>
              ) : (
                runHistory.slice(0, 6).map((run) => (
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
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 float-in">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Recent Reports</p>
              <button
                className="rounded-full border border-neutral-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500 disabled:opacity-70"
                onClick={handleClearReportHistory}
                disabled={reportClearStatus === "clearing" || reportHistory.length === 0}
              >
                {reportClearStatus === "clearing" ? "Clearing..." : "Clear"}
              </button>
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
                <p className="text-xs text-neutral-500">No reports generated yet.</p>
              ) : (
                reportHistory.slice(0, 4).map((report) => (
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
                          handleDeleteReport(report);
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
                    onClick={() => handleDeleteReport(selectedReport)}
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
                    onClick={handleDeleteSelectedRun}
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
