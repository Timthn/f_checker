import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseRouteHistory} from '../src/domain/route-history';
import type {Search} from '../src/domain/contracts';
const fixture=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json','utf8')).provider_response;
const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',currency:'HKD',adults:1,cabin:'economy',carry_on:0,checked:0},at='2026-10-12T00:00:00Z';
const copy=()=>structuredClone(fixture);
describe('provider route reference history',()=>{
 it('retains source time on delayed retrieval and rejects absent, invalid or future source time',()=>{
  const s=parseRouteHistory(fixture,query,at)!;
  expect(s.observed_at).toBe(fixture.scraped_at);expect(s.fetched_at).toBe(new Date(at).toISOString());
  expect(Date.parse(at)-Date.parse(s.observed_at)).toBeGreaterThan(900000);
  for(const timestamp of [undefined,'not-date','2026-10-13T00:00:00Z']){const raw=copy();raw.scraped_at=timestamp;expect(parseRouteHistory(raw,query,at)).toBeNull();}
  const raw=copy();raw.price_insights.price_history=[[Date.parse(raw.scraped_at)/1000+1,10]];expect(parseRouteHistory(raw,query,at)).toBeNull();
 });
 it('projects live-derived search history without claiming itinerary or party scope',()=>{const s=parseRouteHistory(fixture,query,at)!;expect(s.points).toHaveLength(7);expect(s.points[0]).toEqual({day:'2026-08-11',epoch_seconds:1786464000,minor:119400});expect(s.typical_range).toEqual([78000,130000]);expect(s.price_level).toBe('typical');expect(s.price_scope).toBe('provider_search_quote_unverified_party');expect(JSON.stringify(s)).not.toContain('booking');});
 it('rejects foreign currency and changed baggage, route, cabin, adults, trip dates',()=>{for(const patch of [{currency:'USD'},{origin:'SIN'},{adults:2},{cabin:'business'},{carry_on:1},{checked:1},{return_date:'2026-11-17'},{departure:'2026-11-11'}])expect(parseRouteHistory(fixture,{...query,...patch} as Search,at)).toBeNull();const raw=copy();raw.input.currency='USD';expect(parseRouteHistory(raw,query,at)).toBeNull();});
 it('rejects malformed, future, duplicate-day, unsafe and too-large histories',()=>{for(const rows of [[[1,NaN]],[[Date.parse(at)/1000+1,10]],[[1,10],[2,20]],[[Number.MAX_SAFE_INTEGER,10]],Array.from({length:401},(_,j)=>[j*86400,10])]){const raw=copy();raw.price_insights.price_history=rows;expect(parseRouteHistory(raw,query,at)).toBeNull();}});
 it('rejects absent source history and invalid timestamps; preserves optional comparison unknown',()=>{const raw=copy();delete raw.price_insights.lowest_price;delete raw.price_insights.typical_price_range;delete raw.price_insights.price_level;expect(parseRouteHistory(raw,query,at)?.price_level).toBeNull();expect(parseRouteHistory(raw,query,'not-date')).toBeNull();delete raw.price_insights.price_history;expect(parseRouteHistory(raw,query,at)).toBeNull();});
 it('round-trip search history stays route reference; booking history is excluded',()=>{const rt=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json','utf8')).provider_response;expect(parseRouteHistory(rt,{...query,return_date:'2026-11-17'},at)?.scope).toBe('provider_route_reference');const booking=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/one-way-booking.json','utf8')).provider_response;expect(parseRouteHistory(booking,query,at)).toBeNull();});
 it('preserves live-derived business scope and zero-digit currency without currency conversion',()=>{const business=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/business-one-way.json','utf8')).provider_response;expect(parseRouteHistory(business,{...query,cabin:'business'},at)?.points).toHaveLength(7);const raw=copy();raw.currency=raw.input.currency='JPY';expect(parseRouteHistory(raw,{...query,currency:'JPY'},at)?.points[0].minor).toBe(1194);raw.price_insights.price_history=[[1786464000,1.001]];expect(parseRouteHistory(raw,{...query,currency:'JPY'},at)).toBeNull();});
});
