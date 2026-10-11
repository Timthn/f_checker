import { it,expect } from 'vitest';
import { freeAllowance } from '../src/connectors/apify-account';
const now=new Date('2026-10-12T00:00:00Z');
const user={data:{plan:{id:'FREE',monthlyBasePriceUsd:0,monthlyUsageCreditsUsd:5}}};
const limits={data:{monthlyUsageCycle:{startAt:'2026-10-11T00:00:00Z',endAt:'2026-11-10T23:59:59Z'},limits:{maxMonthlyUsageUsd:5},current:{monthlyUsageUsd:0.043746198828673366}}};
it('uses actual account usage and conservative included-credit boundary',()=>{expect(freeAllowance(user,limits,300000,now).remaining_microusd).toBe(4956253);expect(()=>freeAllowance(user,{data:{...limits.data,limits:{maxMonthlyUsageUsd:0.1}}},300000,now)).toThrow('QUOTA_EXCEEDED');});
it('paid plan, exhausted account, stale cycle and missing fields cannot authorize dispatch',()=>{
 expect(()=>freeAllowance({data:{plan:{...user.data.plan,id:'STARTER'}}},limits,30000,now)).toThrow('ACCOUNT_PLAN_NOT_FREE');
 expect(()=>freeAllowance(user,{data:{...limits.data,current:{monthlyUsageUsd:5}}},30000,now)).toThrow('QUOTA_EXCEEDED');
 expect(()=>freeAllowance(user,limits,30000,new Date('2026-12-01'))).toThrow('ACCOUNT_LIMITS_UNVERIFIED');expect(()=>freeAllowance(user,{},30000,now)).toThrow('ACCOUNT_LIMITS_UNVERIFIED');
});
