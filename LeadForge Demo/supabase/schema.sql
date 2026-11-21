-- LeadForge AU starting schema. Review retention, privacy and consent requirements before production.
create extension if not exists pgcrypto;

create type public.prospect_stage as enum ('discovered','audited','approval_requested','build_approved','demo_ready','email_verified','pitched','accepted','declined','suppressed');
create type public.website_presence as enum ('unknown','none_found','existing');
create type public.job_status as enum ('queued','running','succeeded','failed','cancelled');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table public.niches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  search_terms text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id,name)
);
create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'apify',
  provider_run_id text,
  provider_dataset_id text,
  location_query text not null,
  radius_km numeric(7,2),
  niche_ids uuid[] not null default '{}',
  status public.job_status not null default 'queued',
  requested_count integer,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scrape_run_id uuid references public.scrape_runs(id) on delete set null,
  provider_place_id text,
  business_name text not null,
  niche_id uuid references public.niches(id) on delete set null,
  address text,
  suburb text,
  region text,
  country_code char(2) not null default 'AU',
  phone text,
  public_website_url text,
  website_presence public.website_presence not null default 'unknown',
  google_rating numeric(2,1) check (google_rating is null or google_rating between 0 and 5),
  review_count integer check (review_count is null or review_count >= 0),
  provider_categories text[] not null default '{}',
  source_url text,
  source_captured_at timestamptz,
  stage public.prospect_stage not null default 'discovered',
  opportunity_score smallint check (opportunity_score is null or opportunity_score between 0 and 100),
  dedupe_key text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,provider_place_id),
  unique (workspace_id,dedupe_key)
);
create index prospects_workspace_stage_idx on public.prospects(workspace_id,stage,updated_at desc);
create index prospects_workspace_name_idx on public.prospects(workspace_id,business_name);
create table public.review_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  provider_review_id text,
  rating smallint check (rating between 1 and 5),
  review_text text,
  review_date date,
  source_url text,
  captured_at timestamptz not null default now(),
  unique (prospect_id,provider_review_id)
);
create table public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  status public.job_status not null default 'queued',
  website_url text,
  audit_version text,
  overall_score smallint check (overall_score is null or overall_score between 0 and 100),
  mobile_score smallint,
  local_seo_score smallint,
  performance_score smallint,
  accessibility_score smallint,
  review_summary jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  source_captured_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.generation_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  status text not null check (status in ('pending','approved','rejected','expired','cancelled')) default 'pending',
  scope jsonb not null default '{}',
  estimated_cost numeric(10,4),
  maximum_cost numeric(10,4) check (maximum_cost is null or maximum_cost >= 0),
  model_version text,
  prompt_version text,
  approved_at timestamptz,
  expires_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id,idempotency_key)
);
create table public.website_demos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  approval_id uuid not null references public.generation_approvals(id) on delete restrict,
  status public.job_status not null default 'queued',
  preview_url text,
  expires_at timestamptz,
  generated_asset_ref text,
  generation_cost numeric(10,4),
  created_at timestamptz not null default now(),
  unique (approval_id)
);
create table public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  email_address text not null,
  provider text not null default 'hunter',
  result text not null check (result in ('valid','risky','invalid','unknown')),
  provider_response jsonb not null default '{}',
  verified_at timestamptz not null default now(),
  expires_at timestamptz
);
create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  website_demo_id uuid references public.website_demos(id) on delete set null,
  verification_id uuid references public.email_verifications(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  recipient_email text not null,
  subject text not null,
  body_text text not null,
  status text not null check (status in ('draft','approved','queued','sent','delivered','bounced','complained','replied','cancelled')) default 'draft',
  provider_message_id text,
  approved_at timestamptz,
  sent_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.suppression_list (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  normalized_email text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id,normalized_email)
);
create table public.pitch_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  outreach_message_id uuid references public.outreach_messages(id) on delete set null,
  event_type text not null check (event_type in ('opened','clicked','replied','accepted','declined','opted_out','bounced')),
  provider_event_id text,
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_workspace_created_idx on public.activity_events(workspace_id,created_at desc);

-- Authorization helper. SECURITY DEFINER prevents recursive RLS policy lookups.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workspace_members m where m.workspace_id = target_workspace and m.user_id = auth.uid()) $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.niches enable row level security;
alter table public.scrape_runs enable row level security;
alter table public.prospects enable row level security;
alter table public.review_snapshots enable row level security;
alter table public.audit_runs enable row level security;
alter table public.generation_approvals enable row level security;
alter table public.website_demos enable row level security;
alter table public.email_verifications enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.suppression_list enable row level security;
alter table public.pitch_events enable row level security;
alter table public.activity_events enable row level security;

create policy "workspace members can read workspace" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspace owners can update workspace" on public.workspaces for update using (exists (select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create policy "members can read members" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read niches" on public.niches for select using (public.is_workspace_member(workspace_id));
create policy "admins manage niches" on public.niches for all using (exists (select 1 from public.workspace_members m where m.workspace_id=niches.workspace_id and m.user_id=auth.uid() and m.role in ('owner','admin'))) with check (exists (select 1 from public.workspace_members m where m.workspace_id=niches.workspace_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create policy "workspace scoped read scrape runs" on public.scrape_runs for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read prospects" on public.prospects for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read reviews" on public.review_snapshots for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read audits" on public.audit_runs for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read approvals" on public.generation_approvals for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read demos" on public.website_demos for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read verification" on public.email_verifications for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read outreach" on public.outreach_messages for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read suppression" on public.suppression_list for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read pitch events" on public.pitch_events for select using (public.is_workspace_member(workspace_id));
create policy "workspace scoped read activity" on public.activity_events for select using (public.is_workspace_member(workspace_id));

-- Writes to provider jobs, approvals, delivery and generated previews should go through
-- authenticated server endpoints that enforce role, approval, budget and idempotency.
-- Do not grant browser users the service-role key or direct access to provider secrets.
