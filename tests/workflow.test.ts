import { vi,beforeEach,it,expect } from 'vitest';
const f=vi.hoisted(()=>({sleep:vi.fn(),claim:vi.fn(),reserve:vi.fn(),dispatch:vi.fn(),save:vi.fn(),complete:vi.fn(),fail:vi.fn(),suspend:vi.fn(),cancel:vi.fn(),start:vi.fn(),status:vi.fn(),dataset:vi.fn(),parse:vi.fn(),sql:vi.fn(),planSearch:vi.fn(),planReturn:vi.fn(),stage:vi.fn(),private:vi.fn(),purge:vi.fn(),captureBilling:vi.fn(),reconcileBilling:vi.fn()}));
vi.mock('workflow',()=>({sleep:f.sleep,FatalError:class extends Error{},getWorkflowMetadata:()=>({workflowRunId:'qa-workflow'})}));
vi.mock('../src/server/jobs',()=>({claimJob:f.claim,reserveCall:f.reserve,beginDispatch:f.dispatch,saveRun:f.save,completeCall:f.complete,failJob:f.fail,suspendJob:f.suspend,finalizeCancellation:f.cancel}));
vi.mock('../src/server/db',()=>({transaction:async(_kind:unknown,_owner:unknown,fn:(c:unknown)=>unknown)=>fn({query:f.sql})}));
vi.mock('../src/connectors/apify-rest',()=>({startRun:f.start,runStatus:f.status,dataset:f.dataset}));
vi.mock('../src/connectors/apify-adapter',()=>({parseBooking:f.parse}));
vi.mock('../src/connectors/apify-chain',()=>({planSearch:f.planSearch,planReturn:f.planReturn}));
vi.mock('../src/server/provider-chain',()=>({completeStage:f.stage,privateContinuation:f.private,purgeReferences:f.purge,purgeExpiredReferences:f.purge}));
vi.mock('../src/server/provider-reads',()=>({reserveRead:vi.fn()}));
vi.mock('../src/server/provider-allowance',()=>({checkFreeAllowance:vi.fn()}));
vi.mock('../src/server/billing-evidence',()=>({captureRunBilling:f.captureBilling,reconcileJobBilling:f.reconcileBilling}));
import { flightSearch } from '../src/workflows/flight-search';
const job={job_id:'qa-job',owner_id:'qa-owner',workflow_id:'qa-workflow',status:'running',lease_version:'1',cancelled_at:null,query:{origin:'HKG',destination:'NRT'},call_id:'qa-call',run_id:'QARun',dataset_id:'QADataset',provider_phase:'running'};
beforeEach(()=>{vi.resetAllMocks();process.env.LIVE_PROVIDER_ENABLED='true';f.sql.mockResolvedValue({rows:[job]});f.claim.mockResolvedValue(job);f.reserve.mockResolvedValue({phase:'reserved',call_id:'qa-call',ceiling_microusd:'30000'});f.dispatch.mockResolvedValue(true);f.start.mockResolvedValue({runId:'QARun',datasetId:'QADataset'});f.status.mockResolvedValue({status:'RUNNING'});f.planSearch.mockReturnValue({offers:[],next:null,coverage:{returned:0,selected:0}});});
it('capacity waits durably; poll exhaustion becomes explicit and never launches twice',async()=>{f.claim.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(job);await expect(flightSearch('qa-job')).resolves.toBe('qa-job');expect(f.claim).toHaveBeenCalledTimes(3);expect(f.start).toHaveBeenCalledTimes(1);expect(f.status).toHaveBeenCalledTimes(72);expect(f.suspend).toHaveBeenCalledWith('qa-job',false,'qa-workflow');});
it('dataset read failure persists safe reconciliation state without replaying POST',async()=>{f.status.mockResolvedValue({status:'SUCCEEDED'});f.dataset.mockRejectedValue(Error('private upstream diagnostic must not escape'));await flightSearch('qa-job');expect(f.fail).toHaveBeenCalledWith(expect.anything(),'DATASET_RECONCILE_REQUIRED',true);expect(f.start).toHaveBeenCalledTimes(1);expect(f.complete).not.toHaveBeenCalled();});
it('cancelled known run is reconciled by reads without publishing or new dispatch',async()=>{f.sql.mockResolvedValue({rows:[{...job,cancelled_at:'2026-10-12T00:00:00Z',status:'cancelled'}]});f.status.mockResolvedValue({status:'SUCCEEDED',usage:0.01});await flightSearch('qa-job');expect(f.start).not.toHaveBeenCalled();expect(f.status).toHaveBeenCalledTimes(1);expect(f.complete).not.toHaveBeenCalled();expect(f.sql.mock.calls.some(([sql])=>String(sql).includes('update flight.provider_calls set phase='))).toBe(true);});

it('bounded round-trip chain dispatches single private tokens and only whole booking prices',async()=>{
 let phase='search',hasRun=true;
 const outbound={mode:'return' as const,token:'SYNTHETIC_OUTBOUND',selected:[]},inbound={mode:'booking' as const,token:'SYNTHETIC_BOOKING',selected:[]};
 f.sql.mockImplementation(async(sql:string)=>({rows:[String(sql).includes('select j.*')?{...job,phase,query:{...job.query,return_date:'2026-11-17'},...(hasRun?{}:{call_id:null,run_id:null,dataset_id:null})}:job]}));
 f.planSearch.mockReturnValue({offers:[],next:outbound,coverage:{returned:19,selected:1}});f.planReturn.mockReturnValue({offers:[],next:inbound,coverage:{returned:6,selected:1}});
 f.stage.mockImplementation(async(_job, _call,_offers,_usage,next)=>{phase=next.mode;hasRun=false;});
 f.private.mockImplementation(async(_job,mode)=>mode==='return'?outbound:inbound);f.save.mockImplementation(async()=>{hasRun=true;});
 f.status.mockResolvedValue({status:'SUCCEEDED',usage:0.00505});f.dataset.mockResolvedValue([{}]);f.parse.mockReturnValue([{money:{minor:228900,currency:'HKD'}}]);
 await flightSearch('qa-job');
 expect(f.start).toHaveBeenCalledTimes(3);expect(f.start.mock.calls.slice(1).map(([input])=>input)).toEqual([
 {mode:'return',tokens:['SYNTHETIC_OUTBOUND'],maxConcurrency:1,maxRetries:0,includeErrors:true},
 {mode:'booking',tokens:['SYNTHETIC_BOOKING'],maxConcurrency:1,maxRetries:0,includeErrors:true}]);
 expect(f.complete).toHaveBeenCalledWith(expect.anything(),'qa-call',[{money:{minor:228900,currency:'HKD'}}],5050);expect(f.purge).toHaveBeenCalled();
});

it('expired continuation never creates another provider run',async()=>{
 f.sql.mockResolvedValue({rows:[{...job,phase:'return',call_id:null,run_id:null}]});f.private.mockRejectedValue(Error('PROVIDER_REFERENCE_EXPIRED'));
 await flightSearch('qa-job');expect(f.start).toHaveBeenCalledTimes(1);expect(f.reserve).toHaveBeenCalledTimes(1);expect(f.fail).toHaveBeenCalledWith(expect.anything(),'PROVIDER_REFERENCE_EXPIRED',false);
});

it('failed runs capture safe metadata then durably delay the final fee reread',async()=>{
 f.status.mockResolvedValue({status:'FAILED',usage:0.002});
 await expect(flightSearch('qa-job')).resolves.toBe('qa-job');
 expect(f.captureBilling).toHaveBeenCalledWith('qa-owner','qa-call',{status:'FAILED',usage:0.002,runId:'QARun'});
 expect(f.sleep.mock.calls.at(-1)).toEqual(['10s']);
 expect(f.reconcileBilling).toHaveBeenCalledWith('qa-owner','qa-job');
 expect(f.sleep.mock.invocationCallOrder.at(-1)!).toBeLessThan(f.reconcileBilling.mock.invocationCallOrder[0]);
 expect(f.start).toHaveBeenCalledTimes(1);expect(f.dataset).not.toHaveBeenCalled();expect(f.complete).not.toHaveBeenCalled();
});

it('fee reread failure keeps the completed job available without replaying provider creation',async()=>{
 f.status.mockResolvedValue({status:'SUCCEEDED',usage:0.002});f.dataset.mockResolvedValue([{}]);
 f.reconcileBilling.mockRejectedValue(Error('private metadata diagnostic'));
 await expect(flightSearch('qa-job')).resolves.toBe('qa-job');
 expect(f.stage).toHaveBeenCalledTimes(1);expect(f.reconcileBilling).toHaveBeenCalledTimes(1);expect(f.start).toHaveBeenCalledTimes(1);
});
