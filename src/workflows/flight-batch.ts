import {sleep,getWorkflowMetadata} from 'workflow';
import {batchExecutionEnabled} from '@/server/execution-policy';
import {cancelBatch} from '@/server/batches';
import {prepareBatch,recoverStoppedChild} from '@/server/batch-execution';
import {ensureWorkflow} from '@/server/jobs';
import {start,getRun} from 'workflow/api';
import {flightSearch} from './flight-search';
// No requests, credentials, supplier run IDs or booking payloads cross step boundaries.
export async function flightBatch(batchId:string){
 'use workflow';
 for(let i=0;i<185;i++){if(await advance(batchId))return batchId;await sleep('5s');}
 return batchId;
}
async function advance(batchId:string){
 'use step';
 const state=await prepareBatch(batchId,getWorkflowMetadata().workflowRunId);if(state.done)return true;
 // Keep cleanup reachable when a switch is turned off. Only held, undispatched
 // slots are released by cancellation; known/ambiguous calls remain charged.
 if(!batchExecutionEnabled()){await cancelBatch(state.owner!,batchId);return true;}
 for(const child of state.inspect??[]){
  try{if(['failed','cancelled'].includes(await getRun(child.execution).status))await recoverStoppedChild(state.owner!,child.job,child.execution);}catch{/* Missing/timeout status is not proof of stopped execution. */}
 }
 for(const child of state.children){
  try{await ensureWorkflow(state.owner!,child,async id=>(await start(flightSearch,[id])).runId);}catch{/* Durable start claim can be recovered by the next tick. Never create another child. */}
 }
 return false;
}
// Retries may repeat safe SDK starts, never supplier HTTP; child outbox and
// provider dispatch ledger independently fence duplicate delivery.
advance.maxRetries=2;
