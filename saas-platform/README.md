# Rural Atlas SaaS Platform

Analytics-first planning workspace for rural agencies. This app turns corridor questions into metrics, map layers, and exportable PDF briefs.

## Local Development

```bash
npm install
npm run dev
```

App URL: `http://localhost:3000`

## Quality Checks

```bash
npm run lint
npm run build
```

## Core Features

- Run corridor analysis from a plain-language query.
- Upload a local GeoJSON corridor boundary.
- Persist analysis run history and report history in `data/derived`.
- Search/filter run and report history, with incremental load.
- Re-download generated reports from persisted payload snapshots.
- Export and restore backups (replace or merge mode).
- Restore flow validates payload shape and deduplicates by `id`.

## Storage Model

- Runs: `data/derived/runs.json`
- Reports: `data/derived/reports.json`
- Local ingest summary (if available): `data/derived/summary.json`

## API Surface

- `POST /api/analysis`
- `GET /api/runs?q=&limit=`
- `DELETE /api/runs?id=`
- `DELETE /api/runs?all=true`
- `POST /api/report`
- `GET /api/reports?q=&template=&limit=`
- `DELETE /api/reports?id=`
- `DELETE /api/reports?all=true`
- `GET /api/reports/[id]/download`
- `GET /api/backup`
- `POST /api/restore`

## Notes

- Current backup payload includes `schemaVersion: 1`.
- History stores are capped at 50 records each.
