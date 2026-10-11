# Provider evaluation — evidence, not live certification

核对日期 2026-10-11。所有航班搜索、价格、行李正确性、延迟和限流均 **待真实调用验证**。以下是公开 primary-source 文档能力；没有调用任何收费接口，没有获取真实报价。供应商 sample JSON 不是我们的实测，营销可靠性不等于证据。

## Capability matrix

| Candidate | 往返/商务 | 行李 | 灵活日期 | 历史 | Fit / concern |
|---|---|---|---|---|---|
| Direct SearchApi | 文档有完整往返 token 流程和舱位 | checked/carry-on filters 与 booking baggage 文字；逐段/重量仍待核验 | Calendar departure/return ranges，最多 200 date pairs/request | price_insights 有 history；视作搜索层参考，不能承诺具体航班 | 首选验证对象：契约与 calendar 明确 |
| SerpApi | 完整选去程→选回程→booking | booking options 有行李描述；过滤覆盖需实测 | 需核验当前日期网格接口；不能用搜索本身推断任意双区间能力 | 搜索层 price_history / level / typical range | 备选；官方文档较完整，月套餐 |
| Apify scrapercompany | 文档描述 search/return/booking 模式 | 文档宣称 bags filters；返回证据和重量需实测 | calendar/date grid | 宣称 insights；粒度待核验 | 按请求付费候选；社区 Actor，维护/运行 SLA 待验证 |
| Apify johnvc | 搜索有往返；booking 限单程 | 单程 booking baggage 描述 | 不以未证实能力记支持 | insights 不等于具体行程历史 | 不能作为四功能唯一主 connector |
| Kiwi MCP | 官方页面支持单程/往返/舱位 | 官方介绍未明确详细行李接口 | 官方介绍 ±3 天；不等于任意两个区间 | 官方介绍未明确历史 | 适合探索备选；tools/list、认证、使用额度待验证 |
| AWeirdDev/flights (fast_flights) | README 展示 Google Flights Python 查询 | 核对到的 README 未建立足够行李能力证据 | 自行编排；没有确认网格能力 | 没有确认可比具体行程历史 | 开源备选；需要自己承担解析失效、代理/反爬维护 |

## Recommendations

先验证 direct SearchApi，不因 Apify 是平台就假定所有 Actor 一样。若其行李/往返无法通过实测，评估 Apify scrapercompany 或 SerpApi；不同时付费订阅多家，不合并不同 provider 的报价历史。

Kiwi 官方安装示例只给 public MCP URL，没有要求 Key；这不证明无限免费、无人认证或允许作为 Dashboard 高并发数据后端。不要强迫用户先申请未证实必需的 Kiwi Key。先读 tools/list 和服务条款，再考虑真实查询。

开源无 Key 不等于零成本或稳定；自维护爬虫不作为初期默认，除非托管数据源验证失败或费用不可接受。不要绕过访问限制来兑现功能。

## Live spike protocol (next stage, not executed)

1. 使用用户同意的一个 provider，设置最大 40 次请求与硬额度；默认不付费超额。
2. HKG→NRT 单程 economy，no checked vs 1 checked；同航班不同 fare；记录币种及费用含否。
3. 同航线完整往返，去回程额度分别确认；商务舱与 mixed cabin 样例。
4. HKG/SIN→NRT 同日到达：检查当地 offset、跨日、token 和 booking expiry。
5. 3×3 flex grid：看日期 pair、行李过滤、最终 booking 总价；核验至少两个候选。
6. 获取 insights：核对 scope、时间戳、窗口和缺失；不能据此直接认证 flight-specific history。
7. 记录脱敏请求/响应、HTTP/result status、延迟、费用单位、schema 差异及 Terms 限制。失败分类与 provider contract fixtures 从这时建立。

Pass gate：完整行程可还原、已知行李需求不会被未知/基础票价冒充、价格不双算、日期/人数/币种可追溯、token 安全、partial/empty/error 可区分。未通过则更换/降级 connector，保留功能未支持说明。

## Sources

- [SearchApi flights](https://www.searchapi.io/docs/google-flights-api)：filter、booking、insights
- [SearchApi calendar](https://www.searchapi.io/docs/google-flights-calendar-api)：两区间与 200 pairs 上限
- [SearchApi pricing](https://www.searchapi.io/pricing)
- [SerpApi flights](https://serpapi.com/google-flights-api) / [booking](https://serpapi.com/google-flights-booking-options) / [pricing](https://serpapi.com/pricing)
- [Apify scrapercompany](https://apify.com/scrapercompany/google-flights-scraper)
- [Apify johnvc](https://apify.com/johnvc/google-flights-data-scraper-flight-and-price-search)
- [Kiwi official MCP](https://www.kiwi.com/en/pages/mcp/)
- [AWeirdDev/flights README](https://github.com/AWeirdDev/flights)
- [Google baggage guidance](https://support.google.com/travel/answer/9074247?hl=en)：尺寸/重量以航空公司规则确认

所有“支持”均是文档层判断，不代表运行时成功率、地区覆盖或供应商每一报价必含该字段。
