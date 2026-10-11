-- Worker entry points carry an opaque job UUID, which must resolve globally.
alter table flight.jobs add constraint jobs_global_id unique(job_id);
grant update(status) on flight.jobs to fc_api;
create index calls_unresolved on flight.provider_calls(job_id)
 where phase in ('dispatching','running','uncertain');
