# Architecture (Hybrid Local + Cloud)

## Goals
- Same data model locally and in cloud.
- Fast, reproducible analytics for rural corridors.
- Simple deployment for solo developer.

## Stack
- Frontend: Next.js + MapLibre + deck.gl
- API: Next.js API routes + Supabase Edge Functions
- DB: Supabase Postgres + PostGIS
- Local analytics: DuckDB + spatial extension
- Tiles: PMTiles (local file + cloud storage)
- Auth: Supabase Auth (magic link)

## Core Services
1. Data Ingest Service
- Pulls national datasets (ACS, LODES, FARS).
- Imports local files (GeoJSON/CSV).
- Writes to PostGIS and local DuckDB cache.

2. Analytics Service
- Accessibility analysis (jobs, services).
- Safety analysis (HIN).
- Equity overlays (ACS demographics).

3. Reporting Service
- Generates PDF summary.
- Exports GeoJSON/CSV.

## Data Model (MVP)
- `projects` (corridor/town)
- `layers` (ingested datasets)
- `analysis_runs` (parameters + outputs)
- `metrics` (computed values)
- `reports` (generated files)

## Data Flow
1. User creates project -> selects corridor boundary.
2. Ingest pulls national datasets clipped to boundary.
3. Analytics runs compute accessibility + HIN + equity metrics.
4. Report generator produces PDF + exports.

## Local/Cloud Parity
- Use same SQL in DuckDB and PostGIS where possible.
- Store queries and parameters with each run for reproducibility.

## Security
- Row-level security on Supabase for multi-tenant use.
- Signed URLs for report downloads.

## Observability (Phase 1)
- Minimal logging to database + console.
- Add error tracking later.
