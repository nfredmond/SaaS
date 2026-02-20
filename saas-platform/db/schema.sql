-- MVP PostGIS schema
-- Note: enable extensions in Supabase dashboard or migration.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  boundary geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  source text not null, -- ACS, LODES, FARS, local
  layer_type text not null, -- points, lines, polygons, raster, hex
  data geometry(Geometry, 4326),
  properties jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  parameters jsonb not null,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists metrics (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analysis_runs(id) on delete cascade,
  name text not null,
  value_numeric double precision,
  value_text text,
  unit text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analysis_runs(id) on delete cascade,
  storage_path text not null,
  format text not null default 'pdf',
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_boundary on projects using gist (boundary);
create index if not exists idx_layers_geom on layers using gist (data);
create index if not exists idx_layers_project on layers (project_id);
create index if not exists idx_analysis_project on analysis_runs (project_id);
create index if not exists idx_metrics_analysis on metrics (analysis_id);
create index if not exists idx_reports_analysis on reports (analysis_id);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
before update on projects
for each row
execute function set_updated_at();
