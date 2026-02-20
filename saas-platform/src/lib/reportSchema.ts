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

export type ReportRecord = {
  id: string;
  createdAt: string;
  fileName: string;
  template: ReportPayload["template"];
  query: string;
  metricCount: number;
  noteCount: number;
  hasPayload?: boolean;
  payload?: ReportPayload;
};

export type AnalysisRun = {
  id: string;
  query: string;
  createdAt: string;
  metrics: Metric[];
  layers: Layer[];
  notes?: string[];
  localSummary?: ReportPayload["localSummary"];
};
