export type Metric = {
  name: string;
  value: number;
  unit: string;
};

export type Layer = {
  name: string;
  type: string;
};

export type ReportPayload = {
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
  template: "corridor" | "ss4a";
};
