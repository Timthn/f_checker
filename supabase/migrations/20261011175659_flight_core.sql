-- Supabase CLI is the sole migration-history owner. Runtime roles receive no DDL.
create schema if not exists flight;
revoke all on schema flight from public, anon, authenticated;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='fc_api') then create role fc_api login nosuperuser nobypassrls nocreatedb nocreaterole noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='fc_worker') then create role fc_worker login nosuperuser nobypassrls nocreatedb nocreaterole noinherit; end if;
end $$;
grant usage on schema flight to fc_api, fc_worker;

create table flight.searches (
 owner_id uuid not null references auth.users(id), search_id uuid not null,
 query jsonb not null, fingerprint text not null, submitted_at timestamptz not null default now(),
 primary key(owner_id,search_id)
);
create table flight.jobs (
 owner_id uuid not null, job_id uuid not null, search_id uuid not null, kind text not null check(kind in ('search','meet','flex','dates')),
 idempotency_key uuid not null, request_hash text not null,
 status text not null default 'queued' check(status in ('queued','running','partial','succeeded','failed','cancelled','uncertain')),
 phase text not null default 'queued', cancelled_at timestamptz, created_at timestamptz not null default now(),
 lease_version bigint not null default 0, lease_until timestamptz, workflow_id text, safe_error text,
 primary key(owner_id,job_id), unique(owner_id,idempotency_key),
 foreign key(owner_id,search_id) references flight.searches(owner_id,search_id)
);
create index jobs_worker_queue on flight.jobs(created_at) where status in ('queued','running');
create table flight.offers (
 owner_id uuid not null, offer_id uuid not null, job_id uuid not null,
 itinerary_id text not null, comparison_key text, provider_result_key text not null,
 observed_at timestamptz not null, expires_at timestamptz not null, payload jsonb not null,
 primary key(owner_id,offer_id), unique(owner_id,job_id,provider_result_key),
 foreign key(owner_id,job_id) references flight.jobs(owner_id,job_id)
);
create index offers_comparison on flight.offers(owner_id,comparison_key,observed_at);
create table flight.observations (
 owner_id uuid not null, offer_id uuid not null, comparison_key text not null,
 observed_at timestamptz not null, fetched_at timestamptz not null default now(),
 amount_minor bigint not null check(amount_minor>0), currency text not null, fresh boolean not null,
 primary key(owner_id,offer_id), foreign key(owner_id,offer_id) references flight.offers(owner_id,offer_id)
);
create index observations_history on flight.observations(owner_id,comparison_key,observed_at);
create table flight.calendar_cells (
 owner_id uuid not null, job_id uuid not null, departure date not null, return_key text not null,
 state text not null check(state in ('coarse','verified','unknown','failed')), amount_minor bigint check(amount_minor>=0), currency text, offer_id uuid,
 primary key(owner_id,job_id,departure,return_key),
 foreign key(owner_id,job_id) references flight.jobs(owner_id,job_id),
 foreign key(owner_id,offer_id) references flight.offers(owner_id,offer_id),
 check(state<>'verified' or (offer_id is not null and amount_minor is not null))
);
create table flight.provider_calls (
 owner_id uuid not null, job_id uuid not null, call_id uuid not null, operation_key text not null,
 phase text not null check(phase in ('reserved','dispatching','running','succeeded','failed','uncertain')),
 ceiling_microusd bigint not null check(ceiling_microusd>0), reported_microusd bigint check(reported_microusd>=0),
 run_id text, dataset_id text, lease_version bigint not null, created_at timestamptz not null default now(),
 primary key(owner_id,call_id), unique(owner_id,job_id,operation_key),
 foreign key(owner_id,job_id) references flight.jobs(owner_id,job_id)
);
create index calls_job on flight.provider_calls(owner_id,job_id);
create table flight.provider_references (
 owner_id uuid not null, call_id uuid not null, reference_key text not null,
 payload jsonb not null, expires_at timestamptz not null,
 primary key(owner_id,call_id,reference_key), foreign key(owner_id,call_id) references flight.provider_calls(owner_id,call_id)
);
create table flight.checkpoints (
 owner_id uuid not null, job_id uuid not null, step text not null, safe_result jsonb not null,
 primary key(owner_id,job_id,step), foreign key(owner_id,job_id) references flight.jobs(owner_id,job_id)
);
create table flight.budget_accounts (
 account_key text primary key, cap_microusd bigint not null check(cap_microusd>=0),
 reserved_microusd bigint not null default 0 check(reserved_microusd>=0),
 calls_reserved integer not null default 0 check(calls_reserved>=0), call_cap integer not null,
 check(reserved_microusd<=cap_microusd), check(calls_reserved<=call_cap)
);
-- Preserve the existing nine-run spike authorization; do not reset on app bootstrap.
insert into flight.budget_accounts values ('spike-lifetime',500000,270000,0,40);

do $$ declare t text; begin
 foreach t in array array['searches','jobs','offers','observations','calendar_cells','provider_calls','provider_references','checkpoints'] loop
   execute format('alter table flight.%I enable row level security',t);
   execute format('alter table flight.%I force row level security',t);
   execute format('create policy owner_access on flight.%I to fc_api using (owner_id = nullif(current_setting(''app.user_id'',true),'''')::uuid) with check (owner_id = nullif(current_setting(''app.user_id'',true),'''')::uuid)',t);
   execute format('create policy worker_access on flight.%I to fc_worker using (true) with check (true)',t);
 end loop;
end $$;
alter table flight.budget_accounts enable row level security;
alter table flight.budget_accounts force row level security;
create policy worker_budget on flight.budget_accounts to fc_worker using(true) with check(true);
grant select on flight.searches,flight.jobs,flight.offers,flight.observations,flight.calendar_cells to fc_api;
grant insert on flight.searches,flight.jobs to fc_api;
grant update(cancelled_at) on flight.jobs to fc_api;
grant select,insert,update on all tables in schema flight to fc_worker;
revoke all on flight.provider_references,flight.provider_calls,flight.checkpoints,flight.budget_accounts from fc_api;
-- No role passwords in migration history. Provision them separately into ignored local configuration.
