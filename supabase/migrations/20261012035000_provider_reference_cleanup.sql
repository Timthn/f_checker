-- Worker can delete only short-lived provider references. API remains denied.
grant delete on flight.provider_references to fc_worker;
create index provider_references_expiry on flight.provider_references(expires_at);
