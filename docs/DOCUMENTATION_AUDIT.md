# 项目文档盘查报告

- 盘查日期：2026-09-14
- 范围：仓库内 Markdown、清单、TODO、状态、架构、设计、README、AGENTS/CLAUDE/CONTEXT、changelog 数据源与文档目录结构。
- 约束：本轮不移动、不删除、不重命名现有文件；仅新增 [文档索引](./README.md) 和本报告，并修正已经确认会误导用户的过期说明。
- 结论：仓库里没有大量“字节级完全复制”的文档，真正的问题是**语义重复、事实源分叉和日期快照冒充当前状态**。

## 基线数据

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| Git 跟踪 Markdown | 57 | `git ls-files '*.md'` |
| 其中历史归档 | 30 | `docs/archive/2026-01-legacy/*.md` |
| 非归档跟踪文档 | 27 | 其余 Markdown |
| 字节级完全相同组 | 0 | 对排除依赖、构建产物和 `.scratch/aramgg-upstream` 后的 Markdown 做 SHA-256 分组 |
| 最高近似度文档对 | `README.md` ↔ `README.en.md` | 5-token shingle Jaccard ≈ 0.162；属于有意的中英双入口，不是冗余副本 |
| 本地未跟踪 Markdown | 2 个有效草稿 + 一整套 upstream 文档副本 | `.scratch/*/spec.md`；`.scratch/aramgg-upstream/**` 被 `.gitignore` 排除 |

因此，整理重点不是“删重复文件”，而是决定每组事实的唯一归属，并把日期材料降级为快照。

## 已确认的问题

### P0：用户文档描述的手动快捷键已失效

**修复前证据：**

- `README.md:69`：自动识别失败时按 `F1`。
- `README.en.md:68`：same claim in English.
- `docs/USER_GUIDE_AUTO_AUGMENT.md:5,30`：继续描述 `F1` 手动截图，并声称保留 `1280x720` 手动截图。
- `docs/USER_GUIDE_AUTO_AUGMENT.md:42`：声称“相同组合不会重复通知”。

**当前代码事实：**

- `src/main/modules/app-config.ts:1330-1331` 注册的是全局快捷键 `F8`，并调用 `triggerManualRefresh('hotkey-F8')`。
- `src/main/auto-screenshot-service.ts:398` 开始实现手动刷新；`:471-472` 强制全尺寸抓取并设置强制重推标记；`:882-883` 在下一次分析中消费该标记。
- 自动识别仍不会对相同组合反复通知；但手动 F8 会强制重新推送同一组合，旧说明已不成立。

**本轮已处理：** 修正中英文 README 和自动海克斯使用指南，统一为 `F8`，并说明“跳过门禁/完整 OCR 冷却，立即全尺寸识别并刷新；同一组合会强制重推”。

### P0：产品范围仍写成纯 ARAM，但当前功能已经包含斗魂竞技场

**ARAM-only 证据：**

- `README.md:17`：面向 Windows 的英雄联盟极地大乱斗桌面助手。
- `README.en.md:17`：Windows desktop companion for ARAM.
- `COMPLETE_ARCHITECTURE.md:5`：把项目定义为“英雄联盟 ARAM 辅助工具”。
- `docs/requirements.md:8`：产品定位仍是 ARAM 极地大乱斗助手。

**Arena 已进入事实源：**

- `AGENTS.md:8,81,83`：Arena/斗魂竞技场会话、queue id 1700 / gameMode `CHERRY`、OP.GG 海克斯统计。
- `CONTEXT.md:23-32`：已经定义“符文榜 / 英雄胜率榜 / 组合榜”三个 Arena 榜单术语。
- 当前代码中已有 Arena 会话、海克斯、棱彩装备、榜单和 item set 写入服务。

**影响：** 新维护者会把斗魂功能当成旁支或误改产品边界；README 的功能表也无法解释当前主界面和榜单。

**建议：**

1. 在 `README.md`、`README.en.md` 的产品描述和功能阶段表加入斗魂竞技场。
2. 在 `COMPLETE_ARCHITECTURE.md` 增加独立“Arena / 斗魂竞技场”章节，覆盖 queue 1700、CHERRY、shopping phase signal、OP.GG 数据、棱彩装备和榜单。
3. 决定 `docs/requirements.md` 是升级成双模式规格，还是标记为历史 ARAM 规格后移入归档。

### P1：文档入口有三份互相漂移的导航

**修复前证据：**

- `README.md:110-120`：中文文档导航。
- `README.en.md:111-118`：英文文档导航。
- `CLAUDE.md:99-112`：另一份“文档指针”列表。

**分叉表现：**

- 中文 README 有 `docs/FEEDBACK.md`，英文 README 没有。
- 两份 README 都没有列出 `GAMEFLOW_DETECTION_GUIDE.md`、`RELEASE_WINDOW_SMOKE.md`、`MATCH_HISTORY_UPLOAD_API.md` 和多数审查快照。
- `CLAUDE.md` 单独列出代码审查、多语言审查和改进建议，却与 README 的集合不一致。

**本轮已处理：** 新增 [docs/README.md](./README.md) 作为唯一文档总索引，并在中英文 README 与 `CLAUDE.md` 增加入口。

**后续建议：** README 只保留“用户必读 5 条”；其余链接全部集中到 `docs/README.md`，避免三处继续维护同一列表。

### P1：`AGENTS.md` 与 `CLAUDE.md` 是两套并行的项目规则

**重叠证据：**

- 架构事实：`AGENTS.md:5-15` 与 `CLAUDE.md:10-23`。
- 发布与安全：`AGENTS.md:59-69` 与 `CLAUDE.md:50-67`。
- LCU/Arena/OCR 边界：`AGENTS.md:81-98` 与 `CLAUDE.md:85-98`。
- 文档指针：`AGENTS.md:8,49,59` 与 `CLAUDE.md:99-112`。

**额外问题：** `CLAUDE.md:8` 要求讨论稿放 `discuss/`，但仓库没有该目录；`.gitignore:19-20` 已把 `.scratch/` 定义为本地草稿区。本轮已把这条规则改为 `.scratch/`（本地、不提交）。

**建议目标：**

- `AGENTS.md` 作为跨工具唯一规则源。
- `CLAUDE.md` 只保留 Claude 特有补充，并链接 `AGENTS.md`；不要再复制同一组架构和安全事实。
- 若两者必须并存，至少在文件头声明优先级和适用范围。

### P1：多份日期报告都在维护“当前状态 / 剩余问题”

**证据：**

- `docs/CODEBASE_AUDIT_2026-05-26.md:11` 是“当前状态索引”，`:45` 是“当前剩余 P1”，`:49` 是“当前剩余 P2 / P3”。
- `docs/CODE_REVIEW_2026-07-10.md:17` 有“后续整改进展”，后面继续列 P1/P2/P3。
- `docs/PROJECT_RECOMMENDATIONS_2026-07-10.md:12` 有“实施进度”，`:273` 又有“后续实施顺序”。
- `docs/REPOSITORY_AUDIT_2026-09-05.md:29` 是“优先级清单”，`:221` 又是“建议实施顺序与验收”。
- `docs/ELECTRON_VITE_MIGRATION_PROGRESS.md:108` 保留“当前执行记录”，`:215` 保留“下一步”。
- `docs/ARAM_LCU_READONLY_RECOMMENDATION_PROGRESS.md:27,39,230` 同时包含当前基础、当前判断和后续注意事项。

**影响：** 同一问题可能在不同日期报告里仍显示为“剩余”，维护者无法判断是否已经完成或过期。

**建议：**

1. 新开一个无日期的 `docs/STATUS.md`（或 `docs/BACKLOG.md`）作为唯一未完成事项清单。
2. 日期报告全部改为快照，不再维护复选框式当前状态。
3. 已完成的 P1/P2/P3 从当前清单删除，只保留在历史文件中。

### P2：`docs/requirements.md` 没有归属

- `docs/requirements.md:1` 是“LOL Tips Client 需求规格文档”，`:8` 明确只描述 ARAM。
- 根 README 和 `CLAUDE.md` 文档指针都没有链接它。
- 它包含早期 OCR 算法细节，后续已经出现 PaddleOCR 标题区域快速路径、Arena 和榜单等新事实。

**建议：** 要么升级为当前双模式需求规格，要么加“历史 ARAM 规格”状态头并移入 `docs/archive/`。本轮没有替项目做这个产品决策。

### P2：性能 / 优化文档有内容交叠，但用途应分清

- `docs/PERFORMANCE_DIAGNOSTICS.md` 负责“如何采样、如何判断当前性能问题”，可保留为当前指南。
- `docs/CLIENT_LOG_OPTIMIZATION_2026-08-26.md:3,79` 是特定日期的日志问题和建议清单，应视为快照。
- `docs/CLIENT_MONITOR_OPTIMIZATION_2026-09-05.md:1,11` 是特定日期的启动窗口/英雄监控优化记录，应视为快照。

**建议：** 当前指南只保留采样和判断口径；历史问题列表归档到带日期的证据/快照目录。

## 重复 / 交叠组清单

| 组 | 文件 | 交叠性质 | 唯一保留目标 | 动作 |
| --- | --- | --- | --- | --- |
| 中英产品入口 | `README.md`、`README.en.md` | 有意双语，不是复制错误 | 两份互为语言版本 | 保持，但导航改为指向 `docs/README.md` |
| Agent 规则 | `AGENTS.md`、`CLAUDE.md` | 架构、安全、LCU、OCR、文档指针重复 | `AGENTS.md` | 将 `CLAUDE.md` 收敛为差异补充和链接 |
| 文档导航 | README 中英文、`CLAUDE.md` | 三份列表漂移 | `docs/README.md` | 已建立总索引，后续缩短其余列表 |
| 项目状态 / backlog | CODEBASE_AUDIT、CODE_REVIEW、PROJECT_RECOMMENDATIONS、REPOSITORY_AUDIT、迁移和进度文档 | 多份“当前/剩余/下一步” | 新的 `docs/STATUS.md` | 日期报告降级为快照 |
| 性能与优化 | PERFORMANCE_DIAGNOSTICS、CLIENT_LOG_OPTIMIZATION、CLIENT_MONITOR_OPTIMIZATION | 同一性能主题在不同日期重复叙述 | `PERFORMANCE_DIAGNOSTICS.md` | 指南 + 日期快照分离 |
| 早期需求与架构 | `docs/requirements.md`、`COMPLETE_ARCHITECTURE.md` | 早期 ARAM 规格与当前架构交叠 | `COMPLETE_ARCHITECTURE.md` | 补 Arena；requirements 决定升级或归档 |
| 历史迁移文档 | `docs/archive/2026-01-legacy/*`、`ELECTRON_VITE_MIGRATION_PROGRESS.md`、`TYPESCRIPT_INTEGRATION.md` | 迁移过程、命令和完成报告 | 当前约定文档 | 归档层保持；当前文档只留可执行约定 |
| 本地 upstream 副本 | `.scratch/aramgg-upstream/**` | 整套 tracked/upstream 文档的本地副本 | 无 | `.gitignore` 已排除；确认不再比对后可本地清理，不影响 Git |

## 建议的目标结构

不要求本轮立刻搬迁。建议下一步按这个最小结构收敛：

```text
README.md / README.en.md            # 产品入口，只保留用户必读
AGENTS.md                           # 唯一跨工具工程规则
CLAUDE.md                           # 仅 Claude 差异补充，链接 AGENTS.md
CONTEXT.md                          # 领域词汇
COMPLETE_ARCHITECTURE.md            # 当前架构，补 Arena
DESIGN.md                           # UI 设计事实源
docs/
  README.md                         # 当前文档总索引
  STATUS.md                         # 唯一当前 backlog（待创建）
  USER_GUIDE_AUTO_AUGMENT.md
  GAMEFLOW_DETECTION_GUIDE.md
  LCU_TROUBLESHOOTING.md
  PERFORMANCE_DIAGNOSTICS.md
  RELEASE_WINDOW_SMOKE.md
  client-api-strategy.md
  MATCH_HISTORY_UPLOAD_API.md
  ELECTRON_APP_UPDATE_STRATEGY.md
  TYPESCRIPT_INTEGRATION.md
  api/                              # OpenAPI
  samples/                          # 脱敏样本
  audits/<YYYY-MM-DD>/              # 原始证据
  archive/                          # 历史文档
```

## 建议执行顺序

1. **本轮已完成：** 修正 F1/F8，增加 `docs/README.md`，把 README 中英文和 `CLAUDE.md` 的入口接到总索引。
2. **下一轮文档更新：** 给 README、README.en、COMPLETE_ARCHITECTURE 增加 Arena/斗魂范围，并检查 USER_GUIDE 的 Arena 使用流程。
3. **收敛 Agent 规则：** 明确 `AGENTS.md` 为唯一规则源，`CLAUDE.md` 只保留差异；保留本轮 `.scratch/` 修正。
4. **建立当前 backlog：** 新建 `docs/STATUS.md`，从各日期报告中提取仍开放的事项；日期报告不再维护“当前状态”。
5. **归档迁移快照：** 将 `CODEBASE_AUDIT_2026-05-26`、`CODE_REVIEW_2026-07-10`、`PROJECT_RECOMMENDATIONS_2026-07-10`、`CLIENT_*` 等按日期迁入 `docs/audits/<date>/` 时，先创建带状态头的索引，避免只移动文件而继续漂移。
6. **处理 requirements：** 要么升级为当前双模式规格，要么标记为历史并归档；不要继续让它保持“无状态、无入口、可能与代码冲突”的中间态。

## 本轮刻意没有做的事

- 没有删除、移动或重命名任何现有文档。
- 没有把 `docs/requirements.md` 强制标成历史，因为“继续维护它还是归档”是产品决策。
- 没有把日期审查文档批量迁入 `docs/audits/`，因为当前没有统一的状态头和后端引用检查；先建立单一 backlog 更安全。
- 没有清理 `.scratch/aramgg-upstream` 的本地副本；它被 Git 忽略，确认不再用于比对后再本地删除即可。
