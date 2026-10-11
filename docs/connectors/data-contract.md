# Internal data contract v0.1

**Application-designed contract**, not Google/Apify official JSON schema or actual provider response. Field naming snake_case. Implementation will generate JSON Schema/OpenAPI from typed models and contract tests.

## Identity and common types
- search_id: UUID per submitted request; fingerprint separate for cache reuse.
- itinerary_id: stable hash of ordered full segment identity (operating/marketing carrier + number + airports + scheduled UTC dates/times). Changed itinerary gets new ID.
- offer_id: immutable UUID per quote snapshot, tied to itinerary and provider.
- comparison_key: hash of itinerary + per-segment cabin + passengers + currency + requested baggage + price completeness + fare/rights + provider. Does not include observed_at/price/token.
- provider_reference: ephemeral token with expiry stored separately server-side; never permanent PK.
- observed_at: actual upstream quote observation UTC, cache reads do not advance it.
- money: `{amount_minor:integer,currency:ISO4217,fraction_digits:integer}`.
- status: confirmed/estimated/unknown/unsupported; null means unknown, not free.

## Planned DTO fields
SearchRequest: origin_airport_ids[], destination_airport_ids[], trip_type, outbound_date, return_date?, passengers{adults,children,infants_in_seat,infants_on_lap}, cabin, requested_baggage, currency, max_stops?, allow_self_transfer, allow_mixed_cabin.

Segment: segment_id, origin, destination, departure_at_utc, arrival_at_utc, departure_local, arrival_local, origin_timezone, destination_timezone, flight_number, marketing_carrier, operating_carrier?, cabin, duration_minutes, baggage_evidence[]; offsets and zones never assumed identical.

上述公开 DTO 是物理 Segment 与本次 offer 的 segment attributes 的组合视图；数据库物理航段不存 cabin/baggage。这些字段存 offer_segments，防止同航班多个舱位互相覆盖。

Offer: offer_id, itinerary_id, provider, comparison_key, fare_name, fare_rights, passengers, requested_baggage, base_price?, required_baggage_fee?, requested_total?, total_includes_baggage{true/false/null}, price_status, fee_scope?, segment_requirements[], observed_at, expires_at?, booking_link_available, source_evidence. Includes unknown_reasons[]. Public URL is separately validated; tokens stay server-side.

Baggage evidence: segment_ids, type{personal_item/carry_on/checked}, included_count?, max_weight_kg?, fee?, fee_basis{per_person/per_bag/per_segment/per_direction/whole_trip/unknown}, source_text, status. Specific weight filtering only if weight is evidenced. Provenance text is inert data, never agent instructions.

Coverage: date_pairs_total, date_pairs_searched, date_pairs_verified, candidate_count_returned, candidate_count_verified, unknown_count, failed_cells[], scope_label. Search-level route history is tagged scope=route_search; own series scope=itinerary_comparable; calendar scope=travel_date_route_minimum.

Signal: level{low/typical/high/insufficient}, method, baseline_median?, baseline_mean?, deviation_percent?, sample_days, window_start/end, last_sample_at, comparison_key, reason. Values not available remain null.

## Illustrative normalized offer

See [example-offer.json](example-offer.json). Its quantities, flight identity, dates and IDs are fictional demonstration values; no booking token or actual URL. Real provider schema fixtures will be added after approved live spike.

## Storage contracts
Raw response sanitization occurs before persistence; no Authorization, API key, POST booking payload or token in docs/Git. Unknown fields preserved in redacted source record but do not become trusted normalized values. Schema parse failures emit provider_schema_changed, not successful empty flights.
