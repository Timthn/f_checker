import {it,expect} from 'vitest';
import {searchPresentation} from '../src/domain/search-presentation';
import {departureWindow} from '../src/domain/flight-presentation';
import {planSearch,planReturn} from '../src/connectors/apify-chain';
import round from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json';
import back from '../docs/connectors/fixtures/apify-build-0.0.2/return-options.json';
import type {Search} from '../src/domain/contracts';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
function data(){const raw=structuredClone(round.provider_response);const first=planSearch({...raw,itineraries:raw.itineraries.map((x,i)=>({...x,departure_token:`fixture-${i}`}))},q);return {out:first.offers,paired:planReturn(back.provider_response,q,first.next!.selected).offers};}
it('no return date suppresses return candidates and paired totals',()=>{const {out,paired}=data(),r=searchPresentation([...paired,...out],{...q,return_date:undefined});expect(r.returns).toEqual([]);expect(r.hero?.segments.every(s=>s.leg_index===0)).toBe(true);expect(r.outbound.length).toBeLessThanOrEqual(10);});
it('round-trip hero uses the exact returned paired quote, never adds outbound amounts',()=>{const {out,paired}=data(),r=searchPresentation([...out,...paired],q);expect(r.returns.length).toBeGreaterThan(0);expect(r.hero).toEqual(r.returns[0]);expect(r.hero?.money.minor).toBe(Math.min(...paired.map(o=>o.money.minor)));expect(r.outbound.length).toBeLessThanOrEqual(10);expect(r.returns.length).toBeLessThanOrEqual(10);});
it('outbound-only results cannot masquerade as a round-trip total',()=>{expect(searchPresentation(data().out,q).hero).toBeNull();});
it('ranks the full candidate pool before taking ten, deduplicating matching schedules',()=>{const o=data().out[0],offers=Array.from({length:12},(_,i)=>({...o,offer_id:`id${i}`,money:{...o.money,minor:1200-i*10},segments:o.segments.map(s=>({...s,flight:`XX ${i}`}))}));const r=searchPresentation(offers,q);expect(r.outbound).toHaveLength(10);expect(r.outbound[0].money.minor).toBe(1090);});
it('15-day radius gives 31 real travel dates centered across month boundaries',()=>{const days=departureWindow('2026-11-10',15);expect(days).toHaveLength(31);expect(days[0]).toBe('2026-10-26');expect(days[15]).toBe('2026-11-10');expect(days[30]).toBe('2026-11-25');});
it('rejects malformed amounts and scales instead of presenting them as cheapest',()=>{const o=data().paired[0],bad=[0,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1].map(minor=>({...o,money:{...o.money,minor}}));bad.push({...o,money:{...o.money,digits:0}});expect(searchPresentation(bad,q).hero).toBeNull();expect(searchPresentation([...bad,o],q).hero).toEqual(o);});

it('detects adding return dates to a saved one-way query without overwriting submitted context',async()=>{const {searchConditionsChanged}=await import('../src/domain/search-presentation');const saved={...q,return_date:undefined};expect(searchConditionsChanged(q,saved)).toBe(true);expect(searchConditionsChanged(saved,{...saved})).toBe(false);expect(searchConditionsChanged({...q,checked:1},q)).toBe(true);});
