'use strict';
const fs=require('node:fs');
const path=require('node:path');
const file='src/workflows/flight-calendar.ts';
const expected=['launch','collect','capacity','exhausted','billing'];
function checkCalendarBuild(manifest,registrations){
 const steps=manifest.steps?.[file];
 if(!steps||Object.keys(steps).length!==5)throw Error('CALENDAR_STEPS_NOT_REGISTERED');
 for(const name of expected)if(steps[name]?.stepId!==`step//./src/workflows/flight-calendar//${name}`)throw Error(`CALENDAR_STEP_MISSING:${name}`);
 if(manifest.workflows?.[file]?.flightCalendar?.workflowId!=='workflow//./src/workflows/flight-calendar//flightCalendar')throw Error('CALENDAR_WORKFLOW_NOT_REGISTERED');
 // The manifest alone is insufficient: the runtime must import this step module.
 if(!/^import\s+["'][^"']*\/workflows\/flight-calendar\.ts["'];?\s*$/m.test(registrations))throw Error('CALENDAR_RUNTIME_IMPORT_MISSING');
 return {calendar_steps:5,calendar_workflows:1,runtime_step_import:true};
}
module.exports={checkCalendarBuild};
if(require.main===module){
 try{
  const root=fs.realpathSync(path.resolve(__dirname,'..'));
  if(fs.realpathSync(process.cwd())!==root)throw Error('WRONG_PROJECT_DIRECTORY');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/app/.well-known/workflow/v1/manifest.json'),'utf8'));
  const registrations=fs.readFileSync(path.join(root,'src/app/.well-known/workflow/v1/flow/__step_registrations.js'),'utf8');
  process.stdout.write(JSON.stringify(checkCalendarBuild(manifest,registrations))+'\n');
 }catch(e){process.stderr.write(`Calendar build guard failed: ${e instanceof Error?e.message:'INVALID_ARTIFACT'}\n`);process.exitCode=1;}
}
