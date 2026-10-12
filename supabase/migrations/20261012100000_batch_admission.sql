-- One immutable logical batch, budgeted as a whole before any child dispatch.
create table flight.batches (
 owner_id uuid not null references auth.users(id),batch_id uuid not null,
 kind text not null check(kind in ('meeting','flexible')),request jsonb not null,plan jsonb not null,
 idempotency_key uuid not null,request_hash text not null,
 status text not null default 'queued' check(status in ('queued','running','partial','succeeded','failed','cancelled','uncertain')),
 cancelled_at timestamptz,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',
 accounting_period text not null,ceiling_microusd bigint not null check(ceiling_microusd between 0 and 500000),call_count integer not null check(call_count between 0 and 40),
 workflow_id text,workflow_start_token uuid,workflow_start_until timestamptz,
 primary key(owner_id,batch_id),unique(owner_id,idempotency_key)
);
create table flight.batch_items (
 owner_id uuid not null,batch_id uuid not null,ordinal integer not null check(ordinal>=0),
 child_job_id uuid not null,query jsonb not null,participants jsonb not null,
 primary key(owner_id,batch_id,ordinal),unique(owner_id,child_job_id),
 foreign key(owner_id,batch_id) references flight.batches(owner_id,batch_id),
 foreign key(owner_id,child_job_id) references flight.jobs(owner_id,job_id)
);
create table flight.batch_slots (
 owner_id uuid not null,batch_id uuid not null,ordinal integer not null,operation_key text not null check(operation_key in ('search','return','booking')),
 ceiling_microusd bigint not null check(ceiling_microusd=30000),
 state text not null default 'held' check(state in ('held','transferred','released')),call_id uuid,
 primary key(owner_id,batch_id,ordinal,operation_key),
 foreign key(owner_id,batch_id,ordinal) references flight.batch_items(owner_id,batch_id,ordinal),
 foreign key(owner_id,call_id) references flight.provider_calls(owner_id,call_id),
 check((state='transferred')=(call_id is not null))
);
create index batch_queue on flight.batches(created_at) where status in ('queued','running');
do $$ declare t text; begin
 foreach t in array array['batches','batch_items','batch_slots'] loop
  execute format('alter table flight.%I enable row level security',t);
  execute format('alter table flight.%I force row level security',t);
  execute format('create policy owner_access on flight.%I to fc_api using(owner_id=nullif(current_setting(''app.user_id'',true),'''')::uuid) with check(owner_id=nullif(current_setting(''app.user_id'',true),'''')::uuid)',t);
  execute format('create policy worker_access on flight.%I to fc_worker using(true) with check(true)',t);
 end loop;
end $$;
grant select on flight.batches,flight.batch_items to fc_api;
revoke all on flight.batches,flight.batch_items,flight.batch_slots from public,anon,authenticated;
grant update(cancelled_at) on flight.batches to fc_api;
grant select,insert,update on flight.batches,flight.batch_items,flight.batch_slots to fc_worker;
revoke all on flight.batch_slots from fc_api;
