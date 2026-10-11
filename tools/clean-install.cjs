// Reproducible installation in a new project-contained directory, with no credentials.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const root=fs.realpathSync(process.cwd());if(path.basename(root)!=='f_checker')throw Error('PROJECT_BOUNDARY');
const target=path.join(root,'data',`clean-install-${randomUUID()}`);fs.mkdirSync(target,{recursive:true});
for(const file of ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json'])fs.copyFileSync(path.join(root,file),path.join(target,file));
for(const dir of ['src','config','docs/connectors/fixtures'])fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true,filter:p=>!p.split(path.sep).includes('.well-known')});
const env={PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,TEMP:path.join(target,'tmp'),TMP:path.join(target,'tmp'),NEXT_TELEMETRY_DISABLED:'1'};fs.mkdirSync(env.TEMP,{recursive:true});
function run(args){const r=spawnSync(process.execPath,args,{cwd:target,env,encoding:'utf8',timeout:240000});console.log((r.stdout??'').slice(-3500));console.log((r.stderr??'').slice(-1500));if(r.status!==0)throw Error(`CLEAN_STEP_FAILED:${args[1]??args[0]}`);}
run(['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js','ci','--cache',path.join(root,'.npm-cache'),'--no-fund']);
run(['node_modules/next/dist/bin/next','build']);
fs.writeFileSync(path.join(root,'data/clean-install-result.json'),JSON.stringify({node:process.version,target,install:true,build:true,credentials_copied:false},null,2));console.log('CLEAN_INSTALL_AND_BUILD_PASSED');
