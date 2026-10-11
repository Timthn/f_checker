alter table flight.provider_calls add column reads_reserved integer not null default 0 check(reads_reserved>=0);
alter table flight.provider_calls add column read_cap integer not null default 30 check(read_cap>0);
alter table flight.provider_calls add constraint provider_read_cap check(reads_reserved<=read_cap);
