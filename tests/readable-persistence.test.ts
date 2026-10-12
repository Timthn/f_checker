import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {PoolClient} from 'pg';
import {parseSearch} from '../src/connectors/apify-adapter';
import {recordOffer} from '../src/server/offer-recording';
import type {Search} from '../src/domain/contracts';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
it('persists bounded airline identity while excluding extra provider secrets from segments',async()=>{
 const raw=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json','utf8')).provider_response;
 const offer=parseSearch(raw,q)[0];Object.assign(offer.segments[0],{booking_token:'secret-untrusted',airline_logo:'untrusted-url'});
 const query=vi.fn().mockResolvedValue({rows:[{offer_id:offer.offer_id}]});
 await recordOffer({query} as unknown as PoolClient,'owner','job','result',offer,q);
 const stored=query.mock.calls[0][1][8];expect(stored.segments[0].airline).toBe(offer.segments[0].airline);expect(stored.segments[0].airline_code).toBe('GK');expect(JSON.stringify(stored)).not.toMatch(/secret-untrusted|airline_logo/);
});
