# Preflight verification

范围：文档引用、模拟 JSON、可点击原型交互与窄屏布局。不是应用 unit / integration tests，不是 provider 真实验证。

核验工具：[tools/preflight-qa.cjs](../../tools/preflight-qa.cjs)，需已有 Node 和 Playwright/Chromium；本阶段使用 Codex 内置 runtime，未给应用安装依赖。复用时需配置自己的 Playwright，不代表全项目已可运行。

实际机器命令：将 `$env:NODE_PATH` 指向本机已有 bundled `node_modules`，`$env:PLAYWRIGHT_BROWSERS_PATH` 指向已有 `C:/Users/Tim Ngan/AppData/Local/ms-playwright`，使用对应 Node 执行 `tools/preflight-qa.cjs`。仅当前进程环境变量，不修改系统 Node/Python，不安装浏览器。

结果文件：[preflight-results.json](preflight-results.json)。截图在 `screenshots/`：search/details/meet/flex desktop 与 meet mobile。主 agent 需查看截图并确认实际结果后再宣称文档阶段完成。

本次结果：45 checks passed、0 failed；10个结果/行李变更/商务舱/详情导航/历史与日期范围区分/数据不足/会合阈值/灵活日期核验状态/五种状态/390px无页面横向溢出/mobile A-B切换/无JS错误/无外部网络请求/文档引用及模拟JSON通过。截图已人工检查search/details/flex desktop和meet mobile。原型非全功能，不代表真实API或最终无障碍认证。

应用单元测试：未实现。应用集成测试：未实现。真实航班 API：未调用。项目干净依赖安装：未进行（尚无应用依赖）。部署：未执行。
