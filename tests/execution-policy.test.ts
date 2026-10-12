import {afterEach,it,expect,vi} from 'vitest';
import {searchExecutionEnabled,jobExecutionEnabled,batchExecutionEnabled} from '../src/server/execution-policy';
afterEach(()=>vi.unstubAllEnvs());
it('batch reference permission admits only its batch children without implying individual or confirmed live mode',()=>{
 vi.stubEnv('LIVE_PROVIDER_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_SEARCH_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_BATCH_ENABLED','true');
 expect(batchExecutionEnabled()).toBe(true);expect(jobExecutionEnabled(true)).toBe(true);expect(jobExecutionEnabled(false)).toBe(false);expect(searchExecutionEnabled()).toBe(false);
});
it('reference discovery cannot enable batch children or confirmed source rights',()=>{
 vi.stubEnv('LIVE_PROVIDER_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_SEARCH_ENABLED','true');
 expect(searchExecutionEnabled()).toBe(true);expect(jobExecutionEnabled(false)).toBe(true);expect(jobExecutionEnabled(true)).toBe(false);
});
it('default fail closed; malformed values never enable IO',()=>{
 vi.stubEnv('LIVE_PROVIDER_ENABLED','false');vi.stubEnv('LIVE_REFERENCE_SEARCH_ENABLED','TRUE');
 expect(searchExecutionEnabled()).toBe(false);expect(jobExecutionEnabled(false)).toBe(false);
});
