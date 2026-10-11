# F Checker

开发前规格与设计交付，2026-10-11。尚未实现应用、未安装应用依赖、未部署。

建议方案：Next.js + FastAPI；本地 SQLite；优先验证直接 SearchApi 数据契约，Apify 作为替代。技术和 provider 都是建议，选定后的真实接口 spike 必须验证行李、完整往返及日期查询。

从 [AGENTS.md](AGENTS.md) 阅读边界与文档索引。打开 [设计原型](docs/design/prototype.html) 查看首页、查询、详情、会合与灵活日期；所有数字均为明确标注的模拟数据。

当前不需要 API Key 来审阅这些交付物。真实验证所需凭证和预算见 [credentials-budget](docs/connectors/credentials-budget.md)。不要把 Token 放到聊天或 Git。

2026-10-12 驾驶舱设计更新：参考用户截图完成8/4主次布局、48px通栏详情、ECharts动态图表及按需交互。见 [设计方向](docs/design/cockpit-direction.md) 与 [浏览器验证](docs/qa/cockpit-verification.md)。
