import {vi,it,expect,afterEach} from 'vitest';
const jobs=vi.hoisted(()=>({createJob:vi.fn(),ensureWorkflow:vi.fn()}));
vi.mock('../src/server/jobs',()=>jobs);
vi.mock('../src/server/auth',()=>({authenticate:async()=> '00000000-0000-4000-8000-000000000001'}));
vi.mock('workflow/api',()=>({start:vi.fn()}));
vi.mock('../src/workflows/flight-search',()=>({flightSearch:vi.fn()}));
import {POST} from '../src/app/api/v1/searches/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('authenticated invalid JSON types use stable errors instead of 500',async()=>{for(const v of [null,[],5,'text']){const r=await POST(new Request('http://localhost/api/v1/searches',{method:'POST',body:JSON.stringify(v)}));expect(r.status).toBe(422);expect((await r.json()).error.code).toBe('INVALID_QUERY');}});
it('malformed JSON never returns provider exceptions',async()=>{const r=await POST(new Request('http://localhost/api/v1/searches',{method:'POST',body:'{'}));expect(r.status).toBe(422);expect(await r.text()).not.toContain('SyntaxError');});
it('individual reference mode admits the same keyed job without enabling the full provider gate',async()=>{
 vi.stubEnv('LIVE_PROVIDER_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_SEARCH_ENABLED','true');
 for(const key of ['DATABASE_URL','WORKER_DATABASE_URL','APIFY_API_TOKEN'])vi.stubEnv(key,'synthetic-test-only');
 jobs.createJob.mockResolvedValue({job_id:'job',reused:true});jobs.ensureWorkflow.mockResolvedValue('workflow');
 const q={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
 const r=await POST(new Request('http://localhost/api/v1/searches',{method:'POST',headers:{'Idempotency-Key':'00000000-0000-4000-8000-000000000001'},body:JSON.stringify(q)}));
 expect(r.status).toBe(202);expect(jobs.createJob).toHaveBeenCalledWith(expect.any(String),q,'00000000-0000-4000-8000-000000000001');expect(jobs.ensureWorkflow).toHaveBeenCalledTimes(1);
});
