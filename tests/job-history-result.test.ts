import {beforeEach,expect,it,vi} from 'vitest';
import type {Search} from '../src/domain/contracts';
const mocks=vi.hoisted(()=>({query:vi.fn(),transaction:vi.fn()}));
vi.mock('../src/server/db',()=>({transaction:mocks.transaction}));
import {jobResults} from '../src/server/analysis';

const owner='owner-a',job='job-a';
const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
beforeEach(()=>{
 mocks.query.mockReset();mocks.transaction.mockReset();
 mocks.transaction.mockImplementation(async(role,id,fn)=>{expect(role).toBe('api');expect(id).toBe(owner);return fn({query:mocks.query});});
});

it('returns the latest saved route history with owner, job and search-fingerprint fences',async()=>{
 const snapshot={scope:'provider_route_reference',price_scope:'provider_search_quote_unverified_party',date_semantics:'provider_epoch_utc_unverified',source:'apify/build0.0.2',observed_at:'2026-10-16T12:00:00Z',points:[{day:'2026-10-15',minor:10000}],price_level:null};
 mocks.query.mockResolvedValueOnce({rows:[{status:'succeeded',safe_error:null,query}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{payload:snapshot}]});
 const result=await jobResults(owner,job);
 expect(result).toMatchObject({job_id:job,status:'succeeded',query,route_history:snapshot});
 expect(mocks.transaction).toHaveBeenCalledWith('api',owner,expect.any(Function));
 expect(mocks.query).toHaveBeenCalledTimes(3);
 const [jobSql,jobParams]=mocks.query.mock.calls[0];
 expect(jobSql).toContain('j.owner_id=$1 and j.job_id=$2');expect(jobParams).toEqual([owner,job]);
 const [sql,params]=mocks.query.mock.calls[2];
 expect(sql).toContain('h.owner_id=$1 and h.job_id=$2');
 expect(sql).toContain('s.owner_id=h.owner_id');expect(sql).toContain('j.owner_id=s.owner_id');
 expect(sql).toContain('j.search_id=s.search_id and j.job_id=h.job_id');
 expect(sql).toContain('h.query_fingerprint=s.fingerprint');expect(sql).toMatch(/order by h\.observed_at desc limit 1$/);
 expect(params).toEqual([owner,job]);
});

it('returns null for an unavailable owned job without reading offers or history',async()=>{
 mocks.query.mockResolvedValueOnce({rows:[]});
 expect(await jobResults(owner,job)).toBeNull();expect(mocks.query).toHaveBeenCalledTimes(1);
 expect(mocks.query.mock.calls[0][1]).toEqual([owner,job]);
});

it.each([{rows:[]},{rows:[{payload:null}]}])('preserves missing route history as null rather than inventing samples %j',async({rows})=>{
 mocks.query.mockResolvedValueOnce({rows:[{status:'partial',safe_error:'untrusted-provider-message',query}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows});
 expect(await jobResults(owner,job)).toMatchObject({route_history:null,safe_error:null,source_count:0});expect(mocks.query).toHaveBeenCalledTimes(3);
});
