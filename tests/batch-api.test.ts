import {vi,it,expect,beforeEach,afterEach} from 'vitest';
const f=vi.hoisted(()=>({auth:vi.fn(),admit:vi.fn(),ensure:vi.fn(),start:vi.fn()}));
vi.mock('../src/server/auth',()=>({authenticate:f.auth}));
vi.mock('../src/server/batches',()=>({admitBatch:f.admit}));
vi.mock('../src/server/batch-execution',()=>({ensureBatchWorkflow:f.ensure}));
vi.mock('../src/workflows/flight-batch',()=>({flightBatch:vi.fn()}));
vi.mock('workflow/api',()=>({start:f.start,getRun:vi.fn()}));
import {POST} from '../src/app/api/v1/batches/route';
const query={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const input={kind:'meeting',request:{a:query,b:{...query,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:60,max_budget_microusd:200000,departure_scope:'fixed_departures'}};
const request=(body:unknown=input)=>new Request('http://localhost/api/v1/batches',{method:'POST',headers:{'Idempotency-Key':'00000000-0000-4000-8000-000000000001'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('LIVE_PROVIDER_ENABLED','true');vi.stubEnv('DATABASE_URL','QA_NOT_A_REAL_CONNECTION');f.auth.mockResolvedValue('qa-owner');f.admit.mockResolvedValue({batch_id:'qa-batch',status:'queued',reused:false});});
afterEach(()=>vi.unstubAllEnvs());
it('auth and live gates precede any admission or task start',async()=>{
 f.auth.mockResolvedValueOnce(null);expect((await POST(request())).status).toBe(401);vi.stubEnv('LIVE_PROVIDER_ENABLED','false');const response=await POST(request());expect((await response.json()).error.code).toBe('LIVE_PROVIDER_DISABLED');expect(f.admit).not.toHaveBeenCalled();expect(f.start).not.toHaveBeenCalled();
});
it('invalid bodies are rejected before admission',async()=>{for(const body of [null,[],{kind:'unknown'}, {...input,request:null}])expect((await POST(request(body))).status).toBe(422);expect(f.admit).not.toHaveBeenCalled();});
it('SDK startup failure returns the existing admitted batch for explicit recovery',async()=>{
 f.ensure.mockRejectedValue(Error('private SDK diagnostic'));const response=await POST(request());expect(response.status).toBe(202);expect(await response.json()).toEqual({batch_id:'qa-batch',status:'queued',reused:false,orchestration:'start_retry_required'});expect(f.admit).toHaveBeenCalledTimes(1);
});
