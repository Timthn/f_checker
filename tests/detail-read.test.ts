import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseSearch} from '../src/connectors/apify-adapter';
import type {Search} from '../src/domain/contracts';
const mocks=vi.hoisted(()=>({query:vi.fn(),transaction:vi.fn()}));
vi.mock('../src/server/db',()=>({transaction:mocks.transaction}));
import {offerDetails} from '../src/server/analysis';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
it('reads owner-scoped neighboring prices only for owned details, with a bounded identical-query window',async()=>{
 const raw=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json','utf8')).provider_response,offer=parseSearch(raw,q)[0];
 mocks.transaction.mockImplementation(async(_role,_owner,fn)=>fn({query:mocks.query}));
 mocks.query.mockResolvedValueOnce({rows:[{payload:offer,job_id:'job',query:q}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{offer,query:q}]});
 const result=await offerDetails('owner','offer');expect(mocks.transaction).toHaveBeenCalledWith('api','owner',expect.any(Function));expect(result?.departure_prices).toHaveLength(61);
 const [sql,params]=mocks.query.mock.calls[3];expect(sql).toContain('o.owner_id=$1');expect(sql).toContain('limit 500');expect(sql).toContain("(s.query-'departure')=($5::jsonb-'departure')");expect(params).toEqual(['owner','HKG','NRT','2026-11-10',JSON.stringify(q)]);
 mocks.query.mockClear().mockResolvedValueOnce({rows:[]});expect(await offerDetails('foreign','offer')).toBeNull();expect(mocks.query).toHaveBeenCalledTimes(1);
});
