# Flight cheaker — development handoff and keys

2026-10-12. UI deliverable is a verified standalone prototype, not a completed production Next.js app.75 browser checks passed across layout, language and core demo flows. Recommended development stack: Next.js/TypeScript/ECharts + FastAPI/Python worker + Supabase PostgreSQL/Auth. See [architecture review](reviews/architecture-review-2026-10-12.md) and [data model](architecture/data-design.md).

## What to prepare

| Configuration | Needed for | Where / handling |
|---|---|---|
| Dedicated Supabase project URL/ref | Identify the only permitted cloud project | Supabase project Connect; URL/ref is not secret. Current connector lists zero visible projects. Create/select a development project or grant connector access first. |
| Supabase publishable key (`sb_publishable_…`) | Frontend login/Auth | Project Settings → API Keys. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; public by design, still keep config in environment. Use modern key, legacy anon only if compatibility requires it. |
| Supabase project URL | Frontend Auth and backend token issuer | `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`; same project. |
| Database setup connection/password | Create schema/roles in that project | Project Connect. Store as `MIGRATION_DATABASE_URL` only in local/CI migration environment. SQL password is not the publishable key. |
| Restricted API and worker database URLs | Application SQL connections | `DATABASE_URL` (`fc_api`) and `WORKER_DATABASE_URL` (`fc_worker`), created during initial project setup. Do not run the public API with the administrative connection. |
| SearchApi API key | First real flight capability spike | SearchApi dashboard, `SEARCHAPI_API_KEY` in backend environment only. Start with ≤40 requests and account-specific hourly limits. |

For this design you do **not** need a Supabase secret/service_role key in the application, an OpenAI key, a Google Cloud key, an Apify token and a SerpApi key simultaneously, Figma credentials, or deployment credentials. Supabase's connected MCP is a development management channel; it does not replace application DB/Auth credentials or supply live flight data. If a later server-side admin/storage feature requires a secret key, add it then with limited scope and no `NEXT_PUBLIC_` prefix.

Place secret values in ignored project-local environment files; only placeholders belong in `.env.example`. Do not paste them into chat, screenshots or Git. During setup, the agent should confirm presence/connection success without printing values. Before cloud mutation, assert the exact project ref and schema scope. No other Supabase project or GitHub repository is authorized.

If no Supabase project exists, project creation requires the target organization and a cost check; this phase did not create one or incur charges. A dedicated Free development project is the starting recommendation, subject to account availability. It can be created in the dashboard and then exposed to this connector.

## Budget recommendation

Checked official pages on2026-10-12:

- [SearchApi pricing](https://www.searchapi.io/pricing): signup advertises100 free requests; Developer is USD40/month for10,000 searches. USD4/1,000 is an effective package rate, not a USD4 minimum bill. Verify account trial eligibility and rate limits; do not subscribe before the spike demonstrates baggage/round-trip requirements.
- [Supabase pricing](https://supabase.com/pricing): Free USD0,500MB DB,1GB storage, limited egress; projects may pause after one week inactive. Pro starts at USD25/month; extra compute/projects/usage/tax can increase it. Free has no automatic backups, so development exports matter.
- Start with trial flights + Supabase Free + locally running UI/API/worker. Potential service spend USD0 if those allowances apply; local hardware/network are excluded. After validation, SearchApi paid + Supabase Free is roughly USD40/month; adding base Supabase Pro makes roughly USD65/month before hosting, add-ons and tax. These are scenarios, not subscriptions or guaranteed bills.

One user action can cause many supplier requests. Initial cap40 total for the spike, concurrency2, application cap1,000/month; obey the provider's actual account/hourly ceiling as well. History already stored is free to read from the provider perspective. Automatic monitoring remains off. Reference estimate: verifying10 full round-trip candidates may require1 search +10 return resolutions +10 booking enrichments =21 requests; exact method counts await live proof.

## Ready to start a development goal

No credentials are needed for component porting, pure business rules, fixture-backed adapters and local test scaffolding. Live provider and Supabase integration are explicit gates, not reasons to fake successful data. Recommended sequence:

1. Pin project-only runtime/dependencies; port the approved prototype into responsive typed components with semantic Chinese/English catalogs.
2. Create typed API contracts and deterministic money/baggage/history/rendezvous/flexible-date rules with fixtures.
3. Run a ≤40-call SearchApi capability spike once the backend key is configured; save only sanitized fixtures and billing evidence. Do not finalize unsupported baggage promises.
4. In the named Supabase dev project, create versioned migrations, restricted roles and RLS. Test from an empty database, two-user isolation, persistence and job recovery.
5. Connect UI/API/worker; verify loading/partial/error/expired/insufficient states, localizations and budget/cancellation behavior with real boundaries.
6. Unit/integration/E2E tests, clean environment install, progress/error records, secret scan and push only to `Timthn/f_checker`. Deploy only after platform and authorization are provided.

Suggested next goal text:

> 为 Flight cheaker 开始实际开发，采用本项目推荐的 Next.js + FastAPI + Supabase PostgreSQL/Auth 架构，保留已审阅的浅色双语驾驶舱设计。以 AGENTS.md、product-spec、data-design、localization-spec 和 architecture-review-2026-10-12 为依据。先完成无凭证部分，再使用我指定的 Supabase 开发项目和本地配置的 SearchApi Key 做最多40次的能力验证。真实能力未证实则标待验证，不伪造历史、行李或测试结果。仅修改/提交/推送 Timthn/f_checker；不部署、不订阅、不越预算。应用完成需单元、集成、关键流程测试通过，环境隔离，进度记录更新和推送核验；遇到既定停止规则写清错误和剩余工作。

This text is prepared for user invocation; no new goal or implementation run was started by this document.

## Free deployment addendum

Personal demo recommendation: Vercel Hobby + Render Free + Supabase Free. See [free-deployment](architecture/free-deployment.md) for service sleep, supervised co-located worker, disabled autonomous monitoring, account setup and billing boundaries. Deployment accounts are needed only when deployment starts; no hosting API token is needed now.
