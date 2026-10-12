import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {LiveBatchPanel} from '../src/components/live-batch-panel';
import {en,zh} from '../src/i18n/catalog';
function markup(kind:'meeting'|'flexible',locale:'en'|'zh-Hans'){
 return renderToStaticMarkup(createElement(QueryClientProvider,{client:new QueryClient()},createElement(LiveBatchPanel,{kind,locale,request:{},owner:undefined,token:undefined})));
}
it('renders an explicit, disabled paid action without a nested form or hidden paid submit',()=>{
 const html=markup('meeting','en');
 expect(html).toContain(en.batchPaidQuery);expect(html).toContain('disabled=""');
 expect(html).not.toContain('<form');expect(html.match(/<button/g)?.length).toBe(1);
 expect(html).toContain('type="button"');expect(html).not.toContain(en.batchBudget);
 expect(html).not.toContain('USD');expect(html).toContain(en.authRequired);
});
it('shows affordable fixed departure coverage by default and omits it for flexible date mode',()=>{
 expect(markup('meeting','en')).toContain('value="fixed_departures" selected=""');
 expect(markup('meeting','en')).toContain(en.batchFixedDepartures);
 expect(markup('flexible','en')).not.toContain(en.batchDepartureScope);
});
it('provides concise translated strategy and bounded defaults without cost controls in Chinese',()=>{
 const html=markup('flexible','zh-Hans');expect(html).not.toContain(zh.batchBudget);
 expect(html).toContain(zh.strategyBriefHeuristic);expect(html).toContain(zh.authRequired);
 expect(html).toContain('max="8"');expect(html).toContain('value="3"');
 for(const key of Object.keys(en).filter(k=>k.startsWith('batch')||k==='liveBatch'))expect(zh[key as keyof typeof en]).toBeTruthy();
});
