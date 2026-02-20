"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map } from "maplibre-gl";
import bbox from "@turf/bbox";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

const DEMO_STYLE = "https://demotiles.maplibre.org/style.json";

type SamplePoint = {
  name: string;
  coords: [number, number];
};

const SAMPLE_POINTS: SamplePoint[] = [
  { name: "Town Center", coords: [-97.7431, 30.2672] },
  { name: "School", coords: [-97.7516, 30.2755] },
  { name: "Clinic", coords: [-97.7309, 30.2602] },
];

type GeoJsonFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

type MapViewProps = {
  boundary?: GeoJsonFeature | null;
  showBoundary?: boolean;
  showCrashPoints?: boolean;
  showJobHexes?: boolean;
};

type DemoHexFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: { intensity: number };
};

const demoHexes: { type: "FeatureCollection"; features: DemoHexFeature[] } = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-97.78, 30.28],
            [-97.76, 30.29],
            [-97.74, 30.28],
            [-97.74, 30.26],
            [-97.76, 30.25],
            [-97.78, 30.26],
            [-97.78, 30.28],
          ],
        ],
      },
      properties: { intensity: 0.3 },
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-97.74, 30.28],
            [-97.72, 30.29],
            [-97.7, 30.28],
            [-97.7, 30.26],
            [-97.72, 30.25],
            [-97.74, 30.26],
            [-97.74, 30.28],
          ],
        ],
      },
      properties: { intensity: 0.6 },
    },
  ],
};

export default function MapView({
  boundary,
  showBoundary = true,
  showCrashPoints = true,
  showJobHexes = true,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const boundaryLayer = useMemo(() => {
    if (!boundary || !showBoundary) return null;

    return new GeoJsonLayer({
      id: "corridor-boundary",
      data: boundary,
      stroked: true,
      filled: true,
      getLineColor: [248, 248, 113, 200],
      getFillColor: [248, 248, 113, 40],
      getLineWidth: 2,
      lineWidthMinPixels: 2,
    });
  }, [boundary, showBoundary]);

  const analysisLayer = useMemo(() => {
    if (!showJobHexes) return null;

    return new GeoJsonLayer({
      id: "analysis-hexes",
      data: demoHexes,
      filled: true,
      stroked: true,
      getFillColor: [255, 107, 107],
      getLineColor: [255, 255, 255, 120],
      getLineWidth: 1,
      lineWidthMinPixels: 1,
    });
  }, [showJobHexes]);

  const crashLayer = useMemo(() => {
    if (!showCrashPoints) return null;

    return new ScatterplotLayer({
      id: "sample-points",
      data: SAMPLE_POINTS,
      getPosition: (d: SamplePoint) => d.coords,
      getRadius: 180,
      radiusUnits: "meters",
      getFillColor: [10, 98, 188, 190],
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      pickable: true,
    });
  }, [showCrashPoints]);

  const layers = useMemo(
    () => [crashLayer, analysisLayer, boundaryLayer].filter(Boolean),
    [analysisLayer, boundaryLayer, crashLayer]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEMO_STYLE,
      center: [-97.7431, 30.2672],
      zoom: 11,
      pitch: 20,
      bearing: -10,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    const overlay = new MapboxOverlay({ layers: [] });

    map.addControl(overlay as unknown as maplibregl.IControl);

    overlayRef.current = overlay;
    mapRef.current = map;

    return () => {
      overlay.finalize();
      map.remove();
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({ layers });
  }, [layers]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!boundary) return;

    const map = mapRef.current;
    const [minX, minY, maxX, maxY] = bbox(boundary as Parameters<typeof bbox>[0]);

    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 40, duration: 800 }
    );
  }, [boundary]);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}
