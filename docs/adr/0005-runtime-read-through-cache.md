# ADR-0005：运行时只读获取与磁盘缓存

## Status

Accepted; supersedes the batch-only acquisition part of the earlier workspace ADR-0004.

## Context

早期方案要求离线批处理生成全量静态快照。实际验证发现 OP.GG 首屏 HTML 已包含所需 RSC 数据，按英雄请求通常可在数秒内完成；全量预抓取会增加过期数据和发布维护成本。应用仍需要离线可用性，并且不能在每次识别时重复请求。

## Decision

客户端可在需要某个英雄数据时进行只读 HTTPS 获取，结果写入应用数据目录的 read-through cache。随包快照或完整 cache 优先用于立即展示；过期和缺失数据允许后台刷新。同一进程通过共享的斗魂推荐运行时复用 adapter 与 cache。

## Consequences

- 请求按英雄、按需发生，不做高频轮询。
- cache 写入失败不影响已有随包或内存数据。
- UI 标明来源和获取时间；失败原因可诊断。
- 所有网络细节继续留在 OP.GG adapter 之后。
- 若 OP.GG 条款、页面形态或可用性改变，可替换 adapter，而不修改推荐调用者。

