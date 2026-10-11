import { NextResponse } from 'next/server';
export function error(code:string,status:number,locale='zh-Hans',field:string|null=null){return NextResponse.json({error:{code,params:{},field,retryable:false,request_id:crypto.randomUUID()},meta:{locale:locale==='en'?'en':'zh-Hans',contract_version:'1',server_time:new Date().toISOString()}},{status,headers:{'Cache-Control':'no-store'}});}
