-- Route reference series is deliberately separate from exact comparable observations.
alter table flight.provider_calls add constraint provider_call_job_identity unique(owner_id,job_id,call_id);
create table flight.route_history_snapshots (
 owner_id uuid not null,job_id uuid not null,call_id uuid not null,
 observed_at timestamptz not null,query_fingerprint text not null,payload jsonb not null,
 primary key(owner_id,call_id),
 foreign key(owner_id,job_id) references flight.jobs(owner_id,job_id),
 foreign key(owner_id,job_id,call_id) references flight.provider_calls(owner_id,job_id,call_id)
);
create index route_history_job on flight.route_history_snapshots(owner_id,job_id,observed_at desc);
-- Contains private provider run identifiers; only worker can inspect evidence.
create table flight.billing_evidence (
 owner_id uuid not null,call_id uuid not null,observed_at timestamptz not null,payload jsonb not null,
 primary key(owner_id,call_id,observed_at),
 foreign key(owner_id,call_id) references flight.provider_calls(owner_id,call_id)
);
do $$ declare t text; begin
 foreach t in array array['route_history_snapshots','billing_evidence'] loop
  execute format('alter table flight.%I enable row level security',t);
  execute format('alter table flight.%I force row level security',t);
  execute format('create policy api_owner on flight.%I for all to fc_api using (owner_id::text=current_setting(''app.user_id'',true)) with check (owner_id::text=current_setting(''app.user_id'',true))',t);
  execute format('create policy worker_trusted on flight.%I for all to fc_worker using (true) with check (true)',t);
 end loop;
end $$;
revoke all on flight.route_history_snapshots,flight.billing_evidence from public,anon,authenticated,fc_api;
grant select on flight.route_history_snapshots to fc_api;
grant select,insert,update on flight.route_history_snapshots,flight.billing_evidence to fc_worker;
