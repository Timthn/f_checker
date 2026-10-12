import {afterEach,it,expect,vi} from 'vitest';
import {searchExecutionEnabled,jobExecutionEnabled} from '../src/server/execution-policy';
afterEach(()=>vi.unstubAllEnvs());
it('reference discovery cannot enable batch children or confirmed source rights',()=>{
 vi.stubEnv('LIVE_PROVIDER_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_SEARCH_ENABLED','true');
 expect(searchExecutionEnabled()).toBe(true);expect(jobExecutionEnabled(false)).toBe(true);expect(jobExecutionEnabled(true)).toBe(false);
});
it('default fail closed; malformed values never enable IO',()=>{
 vi.stubEnv('LIVE_PROVIDER_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_SEARCH_ENABLED','TRUE');
 expect(searchExecutionEnabled()).toBe(false);expect(jobExecutionEnabled(false)).toBe(false);
});
