import type {PriceWindow} from '@/domain/price-window';
import {summarizePriceWindow} from '@/domain/price-window';
import {en,zh} from '@/i18n/catalog';
export function DateCoverage({window,locale}:{window?:PriceWindow;locale:'en'|'zh-Hans'}){
 const t=locale==='en'?en:zh;
 return <><p>{t.dateQuoteCoverage}</p><strong>{summarizePriceWindow(window).count} / 31</strong><p className="muted">{t[window?.mode==='trip'?'tripDateStats':window?.mode==='return'?'returnDateStats':'outboundDateStats']}</p></>;
}
