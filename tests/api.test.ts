import {vi,it,expect} from 'vitest';
vi.mock('../src/server/auth',()=>({authenticate:async()=> '00000000-0000-4000-8000-000000000001'}));
vi.mock('workflow/api',()=>({start:vi.fn()}));
vi.mock('../src/workflows/flight-search',()=>({flightSearch:vi.fn()}));
import {POST} from '../src/app/api/v1/searches/route';
it('authenticated invalid JSON types use stable errors instead of 500',async()=>{for(const v of [null,[],5,'text']){const r=await POST(new Request('http://localhost/api/v1/searches',{method:'POST',body:JSON.stringify(v)}));expect(r.status).toBe(422);expect((await r.json()).error.code).toBe('INVALID_QUERY');}});
it('malformed JSON never returns provider exceptions',async()=>{const r=await POST(new Request('http://localhost/api/v1/searches',{method:'POST',body:'{'}));expect(r.status).toBe(422);expect(await r.text()).not.toContain('SyntaxError');});
