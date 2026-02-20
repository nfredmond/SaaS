"use client";

import { useState } from "react";

type Metric = {
  name: string;
  value: number;
  unit: string;
};

type Layer = {
  name: string;
  type: string;
};

type ReportPayload = {
  generatedAt: string;
  query: string;
  metrics: Metric[];
  notes: string[];
  layers: Layer[];
  localSummary?: {
    boundaryType?: string;
    bbox?: { minX: number; minY: number; maxX: number; maxY: number } | null;
    centroid?: { lon: number; lat: number } | null;
    generatedAt?: string;
  } | null;
};

export default function ReportPage() {
  const [payload] = useState<ReportPayload | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("rural-atlas-report");
    return stored ? (JSON.parse(stored) as ReportPayload) : null;
  });

  if (!payload) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-neutral-800">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-2xl font-semibold">Corridor Brief</h1>
          <p>No report payload found. Generate a report from the main dashboard first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10 text-neutral-900 print:bg-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 border-b border-neutral-200 pb-4">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Rural Atlas</p>
          <h1 className="text-3xl font-semibold">FHWA-Ready Corridor Brief</h1>
          <p className="text-sm text-neutral-500">
            Generated {new Date(payload.generatedAt).toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm"
              onClick={() => window.print()}
            >
              Print / Save as PDF
            </button>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Executive Summary</h2>
          <p className="text-sm text-neutral-700">
            This corridor analysis summarizes safety, access, and equity indicators for rural
            decision-makers. The findings below are intended for rapid scoping and grant-ready
            documentation.
          </p>
          <p className="text-sm text-neutral-700">
            Query: <span className="font-semibold">{payload.query}</span>
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {payload.metrics.map((metric) => (
            <div key={metric.name} className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{metric.name}</p>
              <p className="text-2xl font-semibold">
                {metric.unit === "ratio"
                  ? `${Math.round(metric.value * 100)}%`
                  : metric.value.toLocaleString()}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Notes & Interpretation</h2>
          <div className="space-y-2 text-sm text-neutral-700">
            {payload.notes.length ? (
              payload.notes.map((note) => <p key={note}>{note}</p>)
            ) : (
              <p>No notes captured for this run.</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Active Data Layers</h2>
          <div className="grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
            {payload.layers.map((layer) => (
              <div key={layer.name} className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2">
                <span>{layer.name}</span>
                <span className="text-xs text-neutral-500">{layer.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Local Ingest Summary</h2>
          {payload.localSummary ? (
            <div className="space-y-2 text-sm text-neutral-700">
              <p>Boundary: {payload.localSummary.boundaryType ?? "unknown"}</p>
              {payload.localSummary.bbox ? (
                <p>
                  BBox: {payload.localSummary.bbox.minX.toFixed(3)}, {payload.localSummary.bbox.minY.toFixed(3)} →{" "}
                  {payload.localSummary.bbox.maxX.toFixed(3)}, {payload.localSummary.bbox.maxY.toFixed(3)}
                </p>
              ) : null}
              {payload.localSummary.centroid ? (
                <p>
                  Centroid: {payload.localSummary.centroid.lon.toFixed(3)}, {payload.localSummary.centroid.lat.toFixed(3)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-neutral-700">No local ingest data captured.</p>
          )}
        </section>

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          Data sources: ACS 5-year, LODES, FARS, local corridor uploads. This document is a draft
          and should be validated with local stakeholders prior to submission.
        </footer>
      </div>
    </div>
  );
}
