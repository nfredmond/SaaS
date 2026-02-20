# MVP Spec (Analytics-First)

## Goal
Deliver a rural-agency-friendly analytics product that turns plain-English questions into maps, metrics, and a FHWA-ready summary for a single corridor or small town.

## Core User
Rural public agency planner with limited staff, tight budgets, and limited GIS capacity.

## MVP Workflows
1. Data ingest
- Load national datasets automatically.
- Load local GIS/CSV files with minimal setup.

2. Analytics
- Accessibility snapshot (jobs, hospitals, schools).
- High Injury Network (HIN) detection + equity overlays.
- Basic scenario comparison (before/after for a corridor).

3. Outputs
- Shareable map links.
- Auto-generated 2-4 page summary report (FHWA-friendly language).

## MVP Features
- Natural language query box (small set of supported intents, not open-ended).
- Map view with layers, toggles, legend, and measure tool.
- Metric cards for accessibility, safety, equity.
- Export: PDF report and GeoJSON/CSV.

## Data Sources (Phase 1)
- Census ACS 5-year (demographics, commute).
- LEHD/LODES (jobs access).
- FARS (fatal crash points).
- GTFS (if local transit exists).
- OSM base map via PMTiles.

## Success Criteria
- A rural agency can load a corridor file and get a report in < 30 minutes.
- Runs on a laptop and in the cloud with the same outputs.
- Reproducible outputs with audit trail.

## Non-Goals (Phase 1)
- Full ABM modeling.
- Construction tracking.
- Procurement, DBE, or payroll compliance workflows.

## Risks
- Data gaps in rural transit coverage.
- Local crash data availability.
- Over-broad NL queries.

## Mitigations
- Support local CSV import for crashes and transit.
- Offer strict query templates.
- Provide pre-built corridor templates.
