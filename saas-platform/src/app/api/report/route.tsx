import { NextResponse } from "next/server";
import { z } from "zod";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
});

const LayerSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const ReportSchema = z.object({
  generatedAt: z.string(),
  query: z.string(),
  metrics: z.array(MetricSchema),
  notes: z.array(z.string()).default([]),
  layers: z.array(LayerSchema).default([]),
  template: z.enum(["corridor", "ss4a"]),
  localSummary: z
    .object({
      boundaryType: z.string().optional(),
      bbox: z
        .object({
          minX: z.number(),
          minY: z.number(),
          maxX: z.number(),
          maxY: z.number(),
        })
        .nullable()
        .optional(),
      centroid: z
        .object({
          lon: z.number(),
          lat: z.number(),
        })
        .nullable()
        .optional(),
      generatedAt: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#111827" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 6 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 18 },
  sectionTitle: { fontSize: 12, marginTop: 14, marginBottom: 6, fontWeight: "bold" },
  cardRow: { flexDirection: "row", gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 8,
    flexGrow: 1,
  },
  cardLabel: { fontSize: 9, color: "#6b7280", textTransform: "uppercase" },
  cardValue: { fontSize: 16, fontWeight: "bold" },
  paragraph: { marginBottom: 6, lineHeight: 1.4 },
  note: { marginBottom: 4 },
  footer: { marginTop: 18, fontSize: 9, color: "#6b7280" },
});

function formatMetricValue(metric: z.infer<typeof MetricSchema>) {
  if (metric.unit === "ratio") {
    return `${Math.round(metric.value * 100)}%`;
  }
  return metric.value.toLocaleString();
}

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

  const reportTitle =
    payload.template === "ss4a" ? "SS4A Grant Safety Brief" : "FHWA-Ready Corridor Brief";

  const pdf = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{reportTitle}</Text>
        <Text style={styles.subtitle}>
          Generated {new Date(payload.generatedAt).toLocaleString()}
        </Text>

        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <Text style={styles.paragraph}>
          {payload.template === "ss4a"
            ? "This safety-focused brief summarizes high-injury network indicators, crash clusters, and equity considerations to support SS4A grant applications and action planning."
            : "This corridor analysis summarizes safety, access, and equity indicators for rural decision-makers. The findings below are intended for rapid scoping and grant-ready documentation."}
        </Text>
        <Text style={styles.paragraph}>Query: {payload.query}</Text>

        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.cardRow}>
          {payload.metrics.slice(0, 3).map((metric) => (
            <View key={metric.name} style={styles.card}>
              <Text style={styles.cardLabel}>{metric.name}</Text>
              <Text style={styles.cardValue}>{formatMetricValue(metric)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Notes & Interpretation</Text>
        {payload.notes.length ? (
          payload.notes.map((note) => (
            <Text key={note} style={styles.note}>
              • {note}
            </Text>
          ))
        ) : (
          <Text style={styles.note}>No notes captured for this run.</Text>
        )}

        {payload.template === "ss4a" ? (
          <>
            <Text style={styles.sectionTitle}>SS4A Narrative</Text>
            <Text style={styles.paragraph}>
              This corridor demonstrates documented crash risk and proximity to vulnerable
              populations. The proposed countermeasures align with safe system principles and
              support Vision Zero goals.
            </Text>
            <Text style={styles.paragraph}>
              Priority strategies include speed management, protected crossings, and corridor
              treatments targeted to high-risk segments identified in the analysis.
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Local Ingest Summary</Text>
        {payload.localSummary ? (
          <>
            <Text style={styles.paragraph}>
              Boundary: {payload.localSummary.boundaryType ?? "unknown"}
            </Text>
            {payload.localSummary.bbox ? (
              <Text style={styles.paragraph}>
                BBox: {payload.localSummary.bbox.minX.toFixed(3)},{" "}
                {payload.localSummary.bbox.minY.toFixed(3)} →{" "}
                {payload.localSummary.bbox.maxX.toFixed(3)},{" "}
                {payload.localSummary.bbox.maxY.toFixed(3)}
              </Text>
            ) : null}
            {payload.localSummary.centroid ? (
              <Text style={styles.paragraph}>
                Centroid: {payload.localSummary.centroid.lon.toFixed(3)},{" "}
                {payload.localSummary.centroid.lat.toFixed(3)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.paragraph}>No local ingest data captured.</Text>
        )}

        <Text style={styles.footer}>
          Data sources: ACS 5-year, LODES, FARS, local corridor uploads. This document is a draft
          and should be validated with local stakeholders prior to submission.
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdf);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rural-atlas-report-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf"`,
    },
  });
}

export const runtime = "nodejs";
