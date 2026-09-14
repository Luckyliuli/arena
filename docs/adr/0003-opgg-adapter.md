# ADR-0003：OP.GG 数据位于可替换 adapter 之后

## Status

Accepted

## Context

强化符文推荐需要按英雄聚合的数据。OP.GG 可提供二手统计，但页面结构、可用性和字段口径不受本项目控制。

## Decision

业务模块只依赖斗魂推荐数据 interface。OP.GG URL、HTML/RSC 解析、字段映射和错误分类全部留在 adapter implementation 中。CommunityDragon 提供强化符文和装备的基础事实字典。

## Consequences

- 页面结构变化只修改 OP.GG adapter。
- 无法验证的第三方字段保留来源说明，不映射为平均名次或第一名率。
- 数据不可用时返回明确原因，不用占位数字冒充真实统计。
- 运行时获取与缓存方式见 ADR-0005。

