# Flight cheaker

开发前规格与设计交付，2026-10-11。尚未实现应用、未安装应用依赖、未部署。

当前建议：Next.js + TypeScript全栈 + Supabase PostgreSQL/Auth；[Vercel方案](docs/architecture/vercel-fullstack-option.md)适合个人低频用途，较早FastAPI建议保留为替代；用户选择 Apify Google Flights Actor，真实格式/能力证据见 [Apify验证](docs/connectors/apify-live-spike-2026-10-12.md)。开发方案见 [技术适配](docs/architecture/apify-stack-fit.md)，下一阶段可复制 [Goal prompt](docs/development-goal-prompt.md)。技术和 provider 都是建议，选定后的真实接口 spike 必须验证行李、完整往返及日期查询。

从 [AGENTS.md](AGENTS.md) 阅读边界与文档索引。打开 [设计原型](docs/design/prototype.html) 查看首页、查询、详情、会合与灵活日期；所有数字均为明确标注的模拟数据。

数据模型、架构检查和 Key 清单见 [开发准备](docs/development-readiness.md)；个人免费托管及休眠限制见 [部署建议](docs/architecture/free-deployment.md)。

当前不需要 API Key 来审阅这些交付物。真实验证所需凭证和预算见 [credentials-budget](docs/connectors/credentials-budget.md)。不要把 Token 放到聊天或 Git。

2026-10-12 驾驶舱设计更新：参考用户截图完成8/4主次布局、48px通栏详情、ECharts动态图表及按需交互。见 [设计方向](docs/design/cockpit-direction.md) 与 [浏览器验证](docs/qa/cockpit-verification.md)。

2026-10-12：首页按视口自适应，飞机/航线动效可暂停；支持中文/EN全页面切换及语言记忆。前后端语言处理约定见 [双语规范](docs/architecture/localization-spec.md)。
