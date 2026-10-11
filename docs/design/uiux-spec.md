# UIUX specification v0.2

## Current design — 2026-10-12

本节取代下方 v0.1 的浅色工作台布局。用户提供三张布局参考，并要求航空驾驶舱主题与按需反馈的交互。当前设计规则、配色、参考与布局图见 [cockpit-direction.md](cockpit-direction.md)。

首页是航线画布、飞机俯视示意和三个浮动入口。查询页使用十二列：暖色推荐航班＋ECharts历史报价主卡占八列并跨两行；右侧四列为信号与行李，下方辅助模块。详情页采用浅色通栏，概览/趋势/行程详情三层，层间48px。主要导航移至顶部。窄屏按内容顺序堆叠。

已实现：背景/飞机/前景滚动速差，背景模糊上限2.5px；导航底色跟随；卡片箭头起点扩散翻色；指针附近“进入”提示；主按钮位移上限4px；会合阈值原生分档滑杆（15/30/60/120分钟）；ECharts指针读数、趋势缩放与日期热力图；圆形换肤（不支持View Transitions时即时降级）。手机不启用指针/磁吸；减少动态效果时禁用非必要动画。航班、价格与输入不模糊。

当前 [prototype.html](prototype.html) 使用本地CSS/JS/ECharts，无需Key或应用安装。旧原型保留为 [prototype-v1.html](prototype-v1.html)。Meet与Flex仍为明确标记的固定查询样本，非完整查询实现。

## Historical v0.1 baseline

目标：像清晰的旅行研究工作台，而不是促销订票网站。信息密度适中，价格口径、时间与可信程度优先。简体中文为建议默认；机场 IATA、舱位英文可做辅助。

## Visual direction
浅暖灰背景，白色面板，深海军蓝文字，青绿主动作；强调色少量用于选择和已知状态。历史低/正常/高始终有文字与图标，不只颜色。圆角16px卡片、细分隔线、阴影克制；8px间距体系；页面标题28–32px，正文14–16px，金额24–32px且 tabular digits。长航班信息不依赖小字号压缩。

Desktop：左侧200px导航、主区域最大1440px，sticky顶部查询摘要。Search form以3列或4列按宽度自动布局。结果一行含航空/时刻/行李/价格/View details；日期和币种始终存在。Small screens：顶部折叠导航，输入单列，卡片堆叠；meet A/B tab保留推荐对，flex表格内部滚动不造成整页横向溢出。

## Information architecture
导航：找机票 / 会合计划 / 灵活日期；详情由结果进入。顶部显示来源状态、最新查询时间和费用额度入口。详情“历史报价”“日期价格”两个明确选项；主榜旁展示 unknown组数量。

## Search
输入 origin→destination，单程/往返、出返日期、人数、经济/商务、行李快捷选项。高级筛选另展开，自转机/混合舱位默认不允许。主要 CTA“查询机票”；初始介绍示例而不显示假真实结果。

成功：最多十个主榜候选，标题“已获取候选中的最低价”；辅助文案包含币种、人数、行李和verified counts。未知组可展开，不能伪装成更多便宜结果。重新提交前保存用户输入，修改后显示“条件已修改，需重新查询”。

## Details
顶部 route+完整行程日期和 selected fare；右上返回查询。第一行：当前含行李价、30日均价、signal及数据状态。航段时间线/行李权益区在图表旁；选择其他fare更新历史comparison key。
历史图：x轴 observed date、y轴 party total/currency；同一行程系列与provider路线参考不能拼接。文字解释当前值与中位数比较。数据不足显示 empty chart+采样起点，不能画假趋势。
日期价格：出发日期±30天，往返固定长度标签；日历/折线选择一日进入符合该日期的报价，不保留原航班“当前价”误导。路线最低 vs同航班系列标签明确。

## Meet
共享目的地/目标到达日/最大到达差；A/B每侧独立 origin/cabin/baggage。桌面同步并排，可锁定一侧再推荐另一侧。推荐顶部“最低总价”“到达最同步”“更少转机”等标签；每对展示合计/各自总价/到达时间/等待差。alternative明确多花多少、节省多少等待时间；不同到达机场仅显式开启。

## Flexible
两个日期range，停留nights、舱位、行李；显示估计合法date pairs及请求预算。网格行=departure，列=return；disabled非法pair，unknown不填0；verified用文字/标记，coarse报价用“待核验”提示。结果前五个是已验证候选；partial覆盖可继续查询但须预算许可。取消保留完成结果。

## Required states
| State | Visible response |
|---|---|
| Initial | 说明所需输入、来源未配置状态 |
| Loading | 按阶段进度、完成/总数；可取消 |
| Empty | 无符合条件结果，列可调整条件；不改筛选 |
| Error | 错误原因/是否可重试，输入保留 |
| Partial | 覆盖率、未完成范围、仅候选最低标签 |
| Unknown baggage | 额度/附加费待确认，独立组 |
| History insufficient | 样本数/起点与原因，不输出偏高/低 |
| Stale | 上游采集时间和刷新按钮，不生成新Signal |

## Prototype fidelity
[prototype.html](prototype.html) 是离线可点击原型，演示四个页面、行李/舱位对示意价格的变化、Signal图、会合等待阈值、flex日期选择和状态切换。全程顶部标记“模拟数据 · 未连接航班API”。它不是实际数据验证、正式前端实现或 Figma 文件。

不能在本阶段宣称可访问性全面合规；需在真实组件实现后再做键盘/屏幕阅读器测试。原型验证桌面及390px布局、控件交互和JS错误；验证报告在 docs/qa。

## Bilingual copy and landing update

Display name: Flight cheaker. Header offers 中文 / EN with remembered selection. All prototype pages, charts, states and accessible labels switch language. Inner-page headings use direct function names; slogans are concentrated on the landing. Desktop landing fits the available viewport; illustration is animated with pause/reduced-motion support. Details: [localization contract](../architecture/localization-spec.md).
