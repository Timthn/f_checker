import {it,expect} from 'vitest';
import economy from '../docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json';
import round from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json';
import booking from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-booking.json';
import empty from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-with-bags-empty.json';
import calendar from '../docs/connectors/fixtures/apify-build-0.0.2/calendar.json';
import nullableLive from '../docs/connectors/fixtures/apify-build-0.0.2/live-null-price.json';
import {parseSearch,parseBooking,parseCalendar} from '../src/connectors/apify-adapter';
import {en,zh} from '../src/i18n/catalog';
import type {Search} from '../src/domain/contracts';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',adults:1,cabin:'economy',currency:'HKD',carry_on:0,checked:0};
it('parses redacted actual mixed-priced response without manufacturing unpriced offers',()=>{const offers=parseSearch(nullableLive.provider_response,q);expect(nullableLive.original_count).toBe(19);expect(offers).toHaveLength(4);expect(offers.map(o=>o.money.minor)).toEqual(nullableLive.provider_response.itineraries.filter(i=>i.price!==null).map(i=>i.price!*100));expect(offers.every(o=>!o.price_complete&&!o.time_verified&&o.baggage.length===0)).toBe(true);});
it('does not convert missing source prices into zero or discard valid priced peers',()=>{const raw=structuredClone(economy.provider_response);Object.assign(raw.itineraries[0],{price:null});const a=parseSearch(raw,q);expect(a).toHaveLength(2);expect(a.every(o=>o.money.minor>0&&!o.price_complete&&!o.time_verified&&o.baggage.length===0)).toBe(true);raw.itineraries.forEach(c=>Object.assign(c,{price:null}));expect(parseSearch(raw,q)).toEqual([]);Object.assign(raw.itineraries[0],{price:'123'});expect(()=>parseSearch(raw,q)).toThrow();});
it('parses sampled search without promoting aggregate baggage/time/history',()=>{const a=parseSearch(economy.provider_response,q);expect(a).toHaveLength(3);expect(a[0].money.minor).toBe(98900);expect(a[0].baggage).toEqual([]);expect(a[0].comparison_key).toBeNull();expect(a[0].time_verified).toBe(false);expect(JSON.stringify(a)).not.toContain('token');});
it('distinguishes outbound-only roundtrip and valid empty envelope',()=>{expect(parseSearch(round.provider_response,{...q,return_date:'2026-11-17'}).every(o=>!o.complete)).toBe(true);expect(parseSearch(empty.provider_response,q)).toEqual([]);expect(()=>parseSearch({mode:'search'},q)).toThrow();});
it('rejects booking from a different selected itinerary',()=>{expect(()=>parseBooking(booking.provider_response,{...q,return_date:'2026-11-17'},parseSearch(economy.provider_response,q)[0].segments)).toThrow('BOOKING_CONTEXT_MISMATCH');});
it('calendar preserves missing cells and rejects contradictory source display prices',()=>{const c=parseCalendar(calendar.provider_response);expect(c.map(x=>x.state)).toEqual(['coarse','unknown','unknown']);expect(c[1].money).toBeNull();expect(c[2]).toMatchObject({money:null,evidence_reason:'price_display_conflict'});});
it('calendar validates currency-specific display formatting and precision without extracting arbitrary numbers',()=>{
 for(const [currency,display,price] of [['USD','$1,234.50',1234.5],['EUR','€12.30',12.3],['JPY','¥1,234',1234]] as const){const raw={mode:'calendar',prices:[{departure_date:q.departure,return_date:null,currency,display_price:display,price,is_priced:true}]};expect(parseCalendar(raw)[0].state).toBe('coarse');for(const bad of ['USD 1234','HK$1,234','¥1.5','$12,34','price $1234']){expect(parseCalendar({...raw,prices:[{...raw.prices[0],display_price:bad}]} )[0].money).toBeNull();}}
});
it('retains elapsed leg duration including connections without deriving it from naive clocks',()=>{
 const raw=structuredClone(economy.provider_response);raw.itineraries[0].legs[0].duration_minutes=370;
 expect(parseSearch(raw,q)[0].duration_minutes).toBe(370);
 raw.itineraries[0].legs[0].duration_minutes=1;expect(parseSearch(raw,q)[0].duration_minutes).toBeNull();
 const missing=structuredClone(economy.provider_response) as any;delete missing.itineraries[0].legs[0].duration_minutes;expect(parseSearch(missing,q)[0].duration_minutes).toBeNull();
});
it('booking preserves whole journey elapsed durations while retaining unknown fare rights',()=>{
 const raw=structuredClone(booking.provider_response),selected=raw.legs.flatMap((l,leg_index)=>l.segments.map(s=>({leg_index,from:s.departure_airport,to:s.arrival_airport,departure_local:s.departure_time,arrival_local:s.arrival_time,departure_utc:null,arrival_utc:null,arrival_zone:null,flight:s.flight_number,cabin:s.cabin_class,duration:s.duration_minutes})));
 const offers=parseBooking(raw,{...q,return_date:'2026-11-17'},selected);
 expect(offers[0].duration_minutes).toBe(raw.legs.reduce((n,l)=>n+l.duration_minutes,0));expect(offers[0].price_complete).toBe(false);expect(offers[0].time_verified).toBe(false);expect(offers[0].baggage).toEqual([]);
});
it('both semantic catalogs have every key',()=>{expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());expect(Object.values(zh).every(Boolean)).toBe(true);});
