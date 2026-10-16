import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import type {Search} from '../src/domain/contracts';
import {parseRouteHistory} from '../src/domain/route-history';
const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const captured='2026-10-12T12:00:00Z';
const fixture=()=>JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json','utf8')).provider_response;
const tagOnly=(level:unknown='low',empty=false)=>{
 const raw=fixture();raw.scraped_at=captured;
 raw.price_insights={price_level:level,...(empty?{price_history:[]}:{} )};return raw;
};

it.each([false,true])('retains a matched provider tag without inventing historical observations (empty=%s)',empty=>{
 const snapshot=parseRouteHistory(tagOnly('low',empty),query,captured);
 expect(snapshot).toMatchObject({points:[],price_level:'low',scope:'provider_route_reference',price_scope:'provider_search_quote_unverified_party',date_semantics:'provider_epoch_utc_unverified'});
 expect(snapshot?.provider_lowest_minor).toBeNull();expect(snapshot?.typical_range).toBeNull();
});

it('keeps the full query and upstream input fences for tag-only snapshots',()=>{
 expect(parseRouteHistory(tagOnly(),{...query,destination:'TPE'},captured)).toBeNull();
 const mismatch=tagOnly();mismatch.input.checked_bags=1;expect(parseRouteHistory(mismatch,query,captured)).toBeNull();
 expect(parseRouteHistory(tagOnly(),query,'2026-10-12T11:59:59Z')).toBeNull();
});

it.each([{}, {price_history:[]}, {lowest_price:100,typical_price_range:[200,300]}, {price_level:'cheap'}, {price_level:null}, {price_history:[],price_level:'cheap'}])('does not infer a tag or history from insufficient price insights %j',insights=>{
 const raw=tagOnly();raw.price_insights=insights;expect(parseRouteHistory(raw,query,captured)).toBeNull();
});

it('continues rejecting malformed or future supplied history despite a valid source tag',()=>{
 const raw=tagOnly();raw.price_insights.price_history=[['invalid',100]];expect(parseRouteHistory(raw,query,captured)).toBeNull();
 raw.price_insights.price_history=[[Math.floor(Date.parse('2026-10-13T00:00:00Z')/1000),100]];expect(parseRouteHistory(raw,query,captured)).toBeNull();
});
