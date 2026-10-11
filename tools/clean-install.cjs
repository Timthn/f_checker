// Reproducible installation in a new project-contained directory, with no credentials.
const fs=require('node:fs'),path=require('node:path'),{spawnSync,spawn}=require('node:child_process'),{randomUUID}=require('node:crypto'),net=require('node:net');
const root=fs.realpathSync(process.cwd());if(path.basename(root)!=='f_checker')throw Error('PROJECT_BOUNDARY');
const target=path.join(root,'data',`clean-install-${randomUUID()}`);fs.mkdirSync(target,{recursive:true});
for(const file of ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json'])fs.copyFileSync(path.join(root,file),path.join(target,file));
for(const dir of ['src','config','docs/connectors/fixtures'])fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true,filter:p=>!p.split(path.sep).includes('.well-known')});
const env={PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,TEMP:path.join(target,'tmp'),TMP:path.join(target,'tmp'),NEXT_TELEMETRY_DISABLED:'1'};fs.mkdirSync(env.TEMP,{recursive:true});
function run(args){const r=spawnSync(process.execPath,args,{cwd:target,env,encoding:'utf8',timeout:240000});console.log((r.stdout??'').slice(-3500));console.log((r.stderr??'').slice(-1500));if(r.status!==0)throw Error(`CLEAN_STEP_FAILED:${args[1]??args[0]}`);}
run(['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js','ci','--cache',path.join(root,'.npm-cache'),'--no-fund']);
run(['node_modules/next/dist/bin/next','build','--webpack']);
(async()=>{
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:target,env,stdio:['ignore','pipe','pipe']});
 let closed=false;child.on('exit',()=>{closed=true;});child.on('error',()=>{closed=true;});child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
 try{
  let ready=false;for(let i=0;i<30&&!closed;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/v1/health`,{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).provider_live_enabled===false){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
  if(!ready)throw Error('CLEAN_START_FAILED');
  const base=`http://127.0.0.1:${port}`;const page=await fetch(base,{signal:AbortSignal.timeout(10000)});if(!page.ok||!(await page.text()).includes('Flight cheaker'))throw Error('CLEAN_PAGE_FAILED');
  const preview=await fetch(`${base}/api/v1/preview`,{signal:AbortSignal.timeout(10000)});if(!preview.ok||!Array.isArray((await preview.json()).offers))throw Error('CLEAN_PREVIEW_FAILED');
  fs.writeFileSync(path.join(root,'data/clean-install-result.json'),JSON.stringify({node:process.version,target,install:true,build:true,start:true,health:true,page:true,preview:true,credentials_copied:false},null,2));console.log('CLEAN_INSTALL_BUILD_START_AND_PUBLIC_PREVIEW_PASSED');
 }finally{child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
