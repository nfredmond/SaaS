# Database Schema

This is the MVP PostGIS schema for the analytics-first platform.

## Files
- `schema.sql`: Core tables, indexes, and triggers.

## Notes
- Enable `postgis` and `pgcrypto` extensions in Supabase.
- Use `projects.boundary` as the corridor/town geometry to clip national datasets.
- Store raw data in `layers` and computed outputs in `metrics`.
