import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_DIR = path.join(process.cwd(), "data", "derived");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

type GeoJsonFeature = {
  type: "Feature";
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
};

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function extractCoords(coords: unknown, out: number[][]) {
  if (!coords) return;
  if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
    out.push([coords[0], coords[1]]);
    return;
  }
  if (!Array.isArray(coords)) return;
  for (const item of coords) {
    extractCoords(item, out);
  }
}

function bboxFromFeature(feature: GeoJsonFeature | null) {
  const points: number[][] = [];
  extractCoords(feature?.geometry?.coordinates, points);
  if (!points.length) return null;

  let minX = points[0][0];
  let minY = points[0][1];
  let maxX = points[0][0];
  let maxY = points[0][1];

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}

async function main() {
  ensureDir(OUT_DIR);

  const boundaryPath = path.join(DATA_DIR, "boundary.geojson");

  if (!fs.existsSync(boundaryPath)) {
    console.error("Missing data/boundary.geojson. Place a GeoJSON Feature there.");
    process.exit(1);
  }

  const boundary = readJson(boundaryPath) as GeoJsonFeature;
  const bounds = bboxFromFeature(boundary);
  const centroid = bounds
    ? { lon: (bounds.minX + bounds.maxX) / 2, lat: (bounds.minY + bounds.maxY) / 2 }
    : null;

  const summary = {
    boundaryType: boundary?.geometry?.type ?? "unknown",
    generatedAt: new Date().toISOString(),
    bbox: bounds,
    centroid,
    notes: [
      "This is a placeholder ingest script.",
      "Next: add DuckDB + spatial extension to clip ACS/LODES/FARS.",
    ],
  };

  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("Ingest placeholder complete. Wrote data/derived/summary.json");
}

main();
