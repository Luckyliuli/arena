# 当前项目状态

> 最后整理：2026-09-14。这里是唯一的“当前开放事项 / 下一步”入口；`docs/audits/<日期>/` 下的报告都是有时间边界的快照。

## 开放事项

- [ ] 决定 `docs/requirements.md` 的归属：升级为 ARAM + Arena 双模式规格，或标记为早期 ARAM 规格并归档。
- [ ] 完成 `AGENTS.md` / `CLAUDE.md` 收敛：`AGENTS.md` 是唯一规则源，`CLAUDE.md` 只保留 Claude 运行时差异和中文工作偏好。
- [ ] 本地清理 `.scratch/aramgg-upstream`：它被 Git 忽略，但与 upstream 文档和源码重复；确认不再用于比对后可手动删除。

## 本轮或近期已完成

- [x] 新增 `docs/README.md` 文档总索引。
- [x] 新增 `docs/DOCUMENTATION_AUDIT.md`，记录重复组、事实源分叉和迁移顺序。
- [x] 修正 README、README.en 和自动海克斯指南中的 `F1` 过期说明，统一为 `F8` 手动刷新。
- [x] README、README.en 和 `COMPLETE_ARCHITECTURE.md` 补充 Arena / 斗魂竞技场范围。
- [x] 将日期审查、代码评审、性能诊断报告迁入 `docs/audits/<日期>/`。
- [x] 明确 `CLAUDE.md` 的仓库规则优先级低于 `AGENTS.md`。

## 维护规则

1. 当前行为写当前文档；不要继续在日期报告里维护“当前剩余”复选框。
2. 新的开放事项只加到本文件；完成后移入“本轮或近期已完成”并附提交或日期。
3. 原始日志、截图和脱敏样本放 `docs/audits/<日期>/`，叙述性报告也放同一日期目录。
4. 历史文件只通过 `docs/archive/` 保留，不从当前指南直接引用为行为依据。
