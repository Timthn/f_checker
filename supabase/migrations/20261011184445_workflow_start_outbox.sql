alter table flight.jobs add column workflow_start_token uuid;
alter table flight.jobs add column workflow_start_until timestamptz;
