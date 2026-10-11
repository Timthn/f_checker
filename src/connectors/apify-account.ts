import { z } from 'zod';
const amount=z.number().finite().nonnegative();
const user=z.object({data:z.object({plan:z.object({id:z.string(),monthlyBasePriceUsd:amount,monthlyUsageCreditsUsd:amount})})});
const limits=z.object({data:z.object({monthlyUsageCycle:z.object({startAt:z.iso.datetime(),endAt:z.iso.datetime()}),limits:z.object({maxMonthlyUsageUsd:amount}),current:z.object({monthlyUsageUsd:amount})})});

// A limits snapshot is an account observation, never an invoice or permission to upgrade.
export function freeAllowance(userRaw:unknown,limitsRaw:unknown,requiredMicrousd:number,now=new Date()){
 const a=user.safeParse(userRaw),b=limits.safeParse(limitsRaw);
 if(!a.success||!b.success||!Number.isSafeInteger(requiredMicrousd)||requiredMicrousd<=0)throw Error('ACCOUNT_LIMITS_UNVERIFIED');
 const plan=a.data.data.plan,account=b.data.data;
 if(plan.id!=='FREE'||plan.monthlyBasePriceUsd!==0)throw Error('ACCOUNT_PLAN_NOT_FREE');
 if(Date.parse(account.monthlyUsageCycle.startAt)>now.getTime()||Date.parse(account.monthlyUsageCycle.endAt)<now.getTime())throw Error('ACCOUNT_LIMITS_UNVERIFIED');
 const ceiling=Math.min(plan.monthlyUsageCreditsUsd,account.limits.maxMonthlyUsageUsd);
 const remaining=Math.floor(Math.max(0,ceiling-account.current.monthlyUsageUsd)*1000000);
 if(remaining<requiredMicrousd)throw Error('QUOTA_EXCEEDED');
 return {remaining_microusd:remaining,observed_at:now.toISOString(),cycle_end:account.monthlyUsageCycle.endAt};
}
