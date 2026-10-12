import {vi,it,expect,beforeEach} from 'vitest';
const f=vi.hoisted(()=>({prepare:vi.fn(),ensure:vi.fn(),start:vi.fn(),sleep:vi.fn(),run:vi.fn(),recover:vi.fn()}));
vi.mock('workflow',()=>({sleep:f.sleep,getWorkflowMetadata:()=>({workflowRunId:'qa-parent'})}));
vi.mock('workflow/api',()=>({start:f.start,getRun:f.run}));
vi.mock('../src/server/batch-execution',()=>({prepareBatch:f.prepare,recoverStoppedChild:f.recover}));
vi.mock('../src/server/jobs',()=>({ensureWorkflow:f.ensure}));
vi.mock('../src/workflows/flight-search',()=>({flightSearch:vi.fn()}));
import {flightBatch} from '../src/workflows/flight-batch';
beforeEach(()=>{vi.resetAllMocks();f.start.mockResolvedValue({runId:'qa-child-execution'});f.ensure.mockImplementation(async(_owner,id,launch)=>launch(id));});
it('serializes only child IDs, then resumes the same parent until terminal evidence',async()=>{
 f.prepare.mockResolvedValueOnce({done:false,owner:'qa-owner',children:['qa-a','qa-b']}).mockResolvedValue({done:true,owner:'qa-owner',children:[]});
 expect(await flightBatch('qa-batch')).toBe('qa-batch');expect(f.start.mock.calls.map(c=>c[1])).toEqual([['qa-a'],['qa-b']]);expect(f.prepare).toHaveBeenCalledWith('qa-batch','qa-parent');expect(f.sleep).toHaveBeenCalledTimes(1);
});
it('a child startup error retries only durable membership on the next tick',async()=>{
 f.prepare.mockResolvedValueOnce({done:false,owner:'qa-owner',children:['qa-a']}).mockResolvedValueOnce({done:false,owner:'qa-owner',children:['qa-a']}).mockResolvedValue({done:true,owner:null,children:[]});f.ensure.mockRejectedValueOnce(Error('SDK transient'));
 await flightBatch('qa-batch');expect(f.ensure.mock.calls.map(c=>c[1])).toEqual(['qa-a','qa-a']);expect(f.start).toHaveBeenCalledTimes(1);
});
it('terminal or fenced parent does not start any child',async()=>{f.prepare.mockResolvedValue({done:true,owner:null,children:[]});await flightBatch('qa-batch');expect(f.start).not.toHaveBeenCalled();expect(f.sleep).not.toHaveBeenCalled();});
it('only definitive stopped child SDK status reaches conservative recovery',async()=>{
 f.prepare.mockResolvedValueOnce({done:false,owner:'qa-owner',children:[],inspect:[{job:'qa-stopped',execution:'qa-failed'},{job:'qa-live',execution:'qa-running'},{job:'qa-unknown',execution:'qa-missing'}]}).mockResolvedValue({done:true,owner:null,children:[]});
 f.run.mockImplementation(id=>({status:id==='qa-failed'?Promise.resolve('failed'):id==='qa-running'?Promise.resolve('running'):Promise.reject(Error('QA timeout'))}));
 await flightBatch('qa-batch');expect(f.recover).toHaveBeenCalledExactlyOnceWith('qa-owner','qa-stopped','qa-failed');expect(f.start).not.toHaveBeenCalled();
});
