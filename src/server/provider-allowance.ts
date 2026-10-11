import { accountData } from '../connectors/apify-rest';
import { freeAllowance } from '../connectors/apify-account';
import { reserveRead } from './provider-reads';
import { transaction } from './db';

export async function checkFreeAllowance(owner:string,callId:string){
 // Reserve each account metadata read before IO. No untracked automatic account polling.
 await reserveRead(owner,callId);const user=await accountData('user');
 await reserveRead(owner,callId);const limits=await accountData('limits');
 // Subtract every conservative lifetime reservation, including already reported runs,
 // rather than spending credits twice while platform accounting is delayed.
 const reserved=await transaction('worker',null,async c=>(await c.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0]?.reserved_microusd);
 if(reserved===undefined)throw Error('ACCOUNT_LIMITS_UNVERIFIED');
 freeAllowance(user,limits,Number(reserved));
}
