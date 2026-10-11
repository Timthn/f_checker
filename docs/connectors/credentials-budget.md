# Accounts, credentials and query budget

2026-10-11；USD 标价，非账单承诺；购买前重新核对供应商价格和账户权限。当前没有发起付费请求、订阅或部署。

## Credentials
| Item | Needed when | Configuration |
|---|---|---|
| GitHub access | 本仓库读写 | 已有 gh/git 登录已能读取并 clone；不需聊天粘贴 PAT |
| SearchApi account/API key | 选中后真实 spike | backend local env `SEARCHAPI_API_KEY`；官方支持 Bearer header；前端不可见 |
| Apify account/token | 选择 Apify 时 | `APIFY_API_TOKEN`、选定 `APIFY_ACTOR_ID`；确认 Actor 计费/额度 |
| SerpApi account/key | 选择该备选时 | `SERPAPI_API_KEY`；仅后端，query 参数日志脱敏 |
| Kiwi MCP | 决定验证时 | 官方 URL https://mcp.kiwi.com；文档没列必需 Key；认证/额度待连接核对 |
| Open-source scraper | 选择自维护时 | 仓库本身不要求该服务 Key；可能需代理凭证，不能假定永远免 Key |
| SQLite | 本地建议方案 | 不需账户/Key；数据库文件不能进 Git |
| Figma / cloud DB / deploy | 日后确实选用时 | 当前非必需；不预先申请所有账号 |
| OpenAI API | 当前四功能 | 不需要；排序/Signal/会合用确定性算法 |

凭证由用户在本地 `.env` 或环境变量配置，不写聊天、代码、prototype 或 Git。当前 `.env.example` 为将来配置的占位，未读取任何秘密。

## Public published prices
- [SearchApi](https://www.searchapi.io/pricing)：100 free requests for signup；Developer USD40/月含10,000 searches。这不等于按实际一千次付 USD4，也不保证全部试用账户资格。
- [SerpApi](https://serpapi.com/pricing)：Free 250/月；Starter USD25/月含1,000；Developer USD75/月含5,000。实际额度/速度以账户为准。
- [Apify scrapercompany](https://apify.com/scrapercompany/google-flights-scraper)：页面列 search/return/booking 各 USD0.005，calendar USD0.008，locations USD0.002。需核对 Actor 的总费用、平台额度和是否有额外费用。

## Call model (budget estimate, not measured)
Fixed one-way：1 search + V booking enrichments。
Roundtrip：1 search + V return-resolution + V booking，V=需要核验的候选数。
Rendezvous：两侧 × 出发日窗口 × fixed-search flow，不能把“一键”当“一次 API 请求”。
Flex calendar：ceil(valid pairs/provider batch cap) coarse requests + selected date pairs 的 fixed-search flow；若全覆盖需要逐 cell 核验，则乘有效 pair 数。
History：已存快照读取不调用 provider；自动采样任务每次都可能用上述 query flow，默认关闭。

示例一次 3×3 flex，9 valid pairs，Calendar=1；仅选3个日期、各核验3个往返候选：3×(1+3+3)=21，总22 requests，探索而非全范围确认。全9个日期核验则1+9×7=64 requests；候选覆盖仍是 provider 返回范围。

## Initial guardrails proposed
- Live spike最多40 calls，不自动超额；SearchApi signup额度若可用足够初测。
- 固定 query默认最多25 provider calls；会合最多60；flex探索最多80。超出先显示预估/缩小范围，用户明确允许扩大才执行。
- 全局并发初始2，尊重 plan hourly限制；monthly app cap建议1,000 calls（独立于provider套餐额度）；预算和 calls ledger可见。
- Retry 受相同预算限制；已经发出后取消可能仍计费。查询缓存减少调用，非保证供应商缓存计费方式。

## Illustrative month
假设：30次完整往返、每次核验10个候选：630 calls；10次双出发搜索、每侧3个出发日、各核验3个候选：420 calls；10次flex探索22 calls：220 calls；5个行程每天采样30天、每次3 calls：450 calls；合计1720，加20%预留=2064 calls。这个例子包含**可选、默认关闭**的监控，不是默认行为。

SearchApi月套餐成本仍USD40（若适用并≤10k）；SerpApi此规模超过1k，应核对适用套餐，公开5k为USD75；Apify示意假设2000 search/return/booking + 64 calendar → USD10.512，locations/platform/tax等未计，不是最终报价。Connector方法和费用单位尚未实测，不可把所有 providers 当等价一次收费。

本地方案软件托管费USD0（不含电脑、电、网络）；生产 hosting/database/logging 未选，不给出虚构价格。建议先利用单一服务试用验证，不现在同时订阅。
