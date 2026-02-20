# Data Sources (Phase 1)

## National (Auto)
- ACS 5-year: demographics, commute, income.
- LEHD/LODES: jobs by block.
- FARS: fatal crashes.
- OSM: base map for context.

## Local (Manual Upload)
- Corridor boundary (GeoJSON or Shapefile).
- Local crash data (CSV/GeoJSON).
- Transit GTFS (if applicable).

## Ingest Strategy
- Store raw datasets in `layers`.
- Clip to project boundary.
- Normalize to common CRS (EPSG:4326 + 3857 for tiles).

## Outputs
- PostGIS tables for persistent use.
- DuckDB cached extracts for fast local analysis.
- PMTiles for basemap and vector layers.
