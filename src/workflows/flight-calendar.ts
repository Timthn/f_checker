import {sleep,getWorkflowMetadata} from 'workflow';
import {launchCalendar,collectCalendar,finishCalendar,calendarBilling} from '../server/calendar-execution';
// Only job IDs enter durable args; every step result is a boolean.
export async function flightCalendar(jobId:string){
 'use workflow';
 let ready=false;for(let i=0;i<24;i++){if(await launch(jobId)){ready=true;break;}await sleep('5s');}
 if(!ready){await capacity(jobId);return jobId;}
 for(let i=0;i<72;i++){await sleep('5s');if(await collect(jobId)){await sleep('10s');await billing(jobId);return jobId;}}
 await exhausted(jobId);await sleep('10s');await billing(jobId);return jobId;
}
async function launch(id:string){
 'use step';
 return launchCalendar(id,getWorkflowMetadata().workflowRunId);
}
launch.maxRetries=0;
async function collect(id:string){
 'use step';
 return collectCalendar(id,getWorkflowMetadata().workflowRunId);
}
collect.maxRetries=0;
async function capacity(id:string){
 'use step';
 return finishCalendar(id,getWorkflowMetadata().workflowRunId,true);
}
capacity.maxRetries=0;
async function exhausted(id:string){
 'use step';
 return finishCalendar(id,getWorkflowMetadata().workflowRunId,false);
}
exhausted.maxRetries=0;
async function billing(id:string){
 'use step';
 return calendarBilling(id);
}
billing.maxRetries=0;
