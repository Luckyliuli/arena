# 项目文档索引

根目录 [README](../README.md) 面向产品和用户；本页面向维护者、贡献者和 AI 协作者，集中说明当前文档的用途与状态。新增文档后，请在本页补一条入口，避免再出现多份互不一致的导航清单。

## 状态标签

- **当前**：描述当前代码、流程或约定的事实源，修改代码时应同步维护。
- **快照**：带日期的审查、诊断或进度记录，只代表记录当时的状态，不作为当前待办或行为说明。
- **证据**：构建日志、测试输出、截图和脱敏样本，只用于追溯，不当作指南阅读。
- **归档**：历史实现记录，禁止据此判断当前行为。
- **待整理**：内容仍可能有用，但来源、时效或所有权尚未确认。

## 第一入口

| 主题 | 文档 | 状态 |
| --- | --- | --- |
| 产品入口（中文） | [README.md](../README.md) | 当前 |
| Product entry (English) | [README.en.md](../README.en.md) | 当前 |
| 完整架构 | [COMPLETE_ARCHITECTURE.md](../COMPLETE_ARCHITECTURE.md) | 当前 |
| 领域词汇 | [CONTEXT.md](../CONTEXT.md) | 当前 |
| 架构决策 | [adr/README.md](./adr/README.md) | 当前 |
| 仓库协作规范 | [AGENTS.md](../AGENTS.md) | 当前 |
| AI 协作者规则 | [CLAUDE.md](../CLAUDE.md) | 当前；以 AGENTS.md 为规则源 |
| UI 设计系统 | [DESIGN.md](../DESIGN.md) | 当前 |

## 使用与运行指南

| 主题 | 文档 | 状态 |
| --- | --- | --- |
| 自动海克斯识别与 F8 手动刷新 | [USER_GUIDE_AUTO_AUGMENT.md](./USER_GUIDE_AUTO_AUGMENT.md) | 当前 |
| 游戏阶段与 Arena 会话检测 | [GAMEFLOW_DETECTION_GUIDE.md](./GAMEFLOW_DETECTION_GUIDE.md) | 当前 |
| LCU 连接排障 | [LCU_TROUBLESHOOTING.md](./LCU_TROUBLESHOOTING.md) | 当前 |
| 性能与发热排查 | [PERFORMANCE_DIAGNOSTICS.md](./PERFORMANCE_DIAGNOSTICS.md) | 当前 |
| 发布窗口冒烟测试 | [RELEASE_WINDOW_SMOKE.md](./RELEASE_WINDOW_SMOKE.md) | 当前 |
| Electron 版本更新 | [ELECTRON_APP_UPDATE_STRATEGY.md](./ELECTRON_APP_UPDATE_STRATEGY.md) | 当前 |
| 客户端数据 API 分发 | [client-api-strategy.md](./client-api-strategy.md) | 当前 |
| 战绩上传接口 | [MATCH_HISTORY_UPLOAD_API.md](./MATCH_HISTORY_UPLOAD_API.md) | 当前 |
| 反馈与日志边界 | [FEEDBACK.md](./FEEDBACK.md) | 当前 |
| TypeScript 开发约定 | [TYPESCRIPT_INTEGRATION.md](./TYPESCRIPT_INTEGRATION.md) | 当前；历史迁移背景见快照区 |

## 数据、接口与样本

| 内容 | 位置 | 状态 |
| --- | --- | --- |
| 战绩上传 OpenAPI | [api/match-history-upload.openapi.yaml](./api/match-history-upload.openapi.yaml) | 当前 |
| 脱敏真实上传样本 | [samples/match-history-upload.real-sanitized.json](./samples/match-history-upload.real-sanitized.json) | 证据 |
| 2026-09-05 审查证据与截图 | [audits/2026-09-05/](./audits/2026-09-05/) | 证据 |

## 审查、诊断、迁移与进度快照

这些文件带日期或明确记录某一阶段的状态。默认只用于回溯，不应被当作当前 backlog 或当前行为说明。

| 文档 | 状态 |
| --- | --- |
| [项目全面审查（2026-05-26）](./audits/2026-05-26/codebase-audit.md) | 快照 |
| [项目代码全面审查（2026-07-10）](./audits/2026-07-10/code-review.md) | 快照 |
| [客户端多语言数据专项审查（2026-07-10）](./audits/2026-07-10/localized-client-data-review.md) | 快照 |
| [项目改进建议（2026-07-10）](./audits/2026-07-10/project-recommendations.md) | 快照 |
| [客户端日志优化诊断（2026-08-26）](./audits/2026-08-26/client-log-optimization.md) | 快照 |
| [启动窗口与英雄监控优化（2026-09-05）](./audits/2026-09-05/client-monitor-optimization.md) | 快照 |
| [仓库审查（2026-09-05）](./audits/2026-09-05/repository-audit.md) | 快照 |
| [ELECTRON_VITE_MIGRATION_PROGRESS.md](./ELECTRON_VITE_MIGRATION_PROGRESS.md) | 迁移快照；当前架构以 COMPLETE_ARCHITECTURE.md 为准 |
| [ARAM_LCU_READONLY_RECOMMENDATION_PROGRESS.md](./ARAM_LCU_READONLY_RECOMMENDATION_PROGRESS.md) | 功能进度快照 |
| [requirements.md](./requirements.md) | 当前；斗魂竞技场稳定产品要求 |

## 当前状态与整理报告

| 内容 | 文档 | 状态 |
| --- | --- | --- |
| 唯一当前 backlog | [STATUS.md](./STATUS.md) | 当前 |
| 本次全量盘查、重复组与迁移顺序 | [DOCUMENTATION_AUDIT.md](./DOCUMENTATION_AUDIT.md) | 当前 |

## 归档

| 内容 | 入口 | 状态 |
| --- | --- | --- |
| 2026-01 迁移前实现记录、计划、清单和完成报告 | [archive/2026-01-legacy/README.md](./archive/2026-01-legacy/README.md) | 归档 |

## 维护规则

1. **一个主题只保留一个当前事实源。** 其他文档只链接，不复制维护同一组事实。
2. **日期文档默认是快照。** 当前行为写入无日期指南或架构文档；开放事项集中到单一 backlog。
3. **原始证据进 `docs/audits/<YYYY-MM-DD>/`。** 证据目录不再拆出一份叙述性副本。
4. **讨论稿放 `.scratch/`。** 该目录已被 Git 忽略，不进入产品文档导航。
5. **归档内容不反向污染当前文档。** 当前指南不要引用归档文件作为行为依据。
